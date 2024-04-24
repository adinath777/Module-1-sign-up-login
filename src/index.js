const express=require("express")
const app=express()
const path=require("path")
const hbs=require("hbs")
const session = require('express-session');//for knowning current login user
const bcrypt = require('bcrypt'); // Import bcrypt for password hashing
const { Collection } = require("mongoose")
const cron = require('node-cron');//for all auctions check auction winner each minute
const multer=require("multer")
const { Product, Login,Bid } = require('./mongodb');

hbs.registerHelper('formatAuctionStartTime', (dateString) => {
  const date = new Date(dateString);
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  };

  return date.toLocaleString('en-US', options);
});

hbs.registerHelper('formatAuctionEndTime', (dateString) => {
  const date = new Date(dateString);
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  };

  return date.toLocaleString('en-US', options);
});
// Import the moment library
const moment = require('moment');

// Register the formatAuctionStartDateTime helper with Handlebars
hbs.registerHelper('formatAuctionStartDateTime', (dateString) => {
  return moment(dateString).format('MMMM D, YYYY, h:mm:ss A');
});

// Register the formatAuctionStartTimestamp helper with Handlebars
hbs.registerHelper('formatAuctionStartTimestamp', (dateString) => {
  return moment(dateString).unix();
});
hbs.registerHelper('isUpcomingAuction', (auctionStartTime) => {
  const now = new Date();
  return now < auctionStartTime;
});

hbs.registerHelper('isLiveAuction', (auctionStartTime, auctionEndTime) => {
  const now = new Date();
  return now >= auctionStartTime && now < auctionEndTime;
});
// In your server-side code (e.g., Express app)

hbs.registerHelper('formatAuctionEndTimestamp', (dateString) => {
  return moment(dateString).unix();
});


app.use(express.json())

app.use(express.urlencoded({extended:false}))


app.use(session({
  secret: 'secrete',        // sign the session id cookie
  resave: false,           // the session should be saved back to the session store, even if it hasn't been modified during the request. 
  saveUninitialized: true //new but unmodified session should be saved to the store or not.
}));

app.use(express.static('public'))
app.set("view engine","hbs")

//route protection

const isAuthenticated = (req, res, next) => {
  if (req.session.username) {
    // User is authenticated, proceed to the next middleware or route handler
    next();
  } else {
    // User is not authenticated, redirect to the login page
    res.redirect('/');
  }
};



app.get('/', async (req, res) => {
  try {
    const now = new Date();
    const upcomingProducts = await Product.find({ auctionStartTime: { $gt: now } });
    const liveProducts = await Product.find({
      auctionStartTime: { $lte: now },
      auctionEndTime: { $gt: now },
    });

    // Render the index.hbs template and pass the upcomingProducts and liveProducts data
    res.render('index', { upcomingProducts, liveProducts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching products');
  }
});

app.get('/blog',async(req,res)=>{
  try{
    res.render('blog');
  }
  catch(err){
    console.error(err);
    res.status(500).send('Error loading blog');
  }
})

app.get("/login",(req,res)=>{
  res.render("login")
})

app.get("/signup",(req,res)=>{
    res.render("signup")
})
app.get("/seller",isAuthenticated,(req,res)=>{
    res.render("seller",{layout:"/layouts/sellerLayout"})
})

app.get('/sellorbuy',isAuthenticated, (req, res) => {
    res.render('sellorbuy');
  });

  app.get('/addproducts', isAuthenticated,async (req, res) => {
    const loggedInUserName = req.session.username;
    const user = await Login.findOne({ name: loggedInUserName });
  
    if (user) {
    res.render('addproducts', { layout: '/layouts/sellerLayout',user });
   
      }
     else {
      // Handle the case when the user is not found
      // For example, redirect to the login page
      res.redirect('/');
    }
  });
 
  //to logout

  app.get('/logout',isAuthenticated, (req, res) => {
    // Clear the session data
    req.session.destroy();
    // Redirect to the login page
    res.redirect('/');
  });


//to get coresponding profile page for each seller

app.get('/sellerprofile', isAuthenticated,async (req, res) => {
  try {
    const loggedInUserName = req.session.username;
    const user = await Login.findOne({ name: loggedInUserName });
    if (user) {
      res.render('sellerprofile', { layout: '/layouts/sellerLayout', user  });
    } else {
      res.status(404).send('User not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching user details');
  }
});

app.post('/sellerprofile', async (req, res) => {
  try {
    const loggedInUserName = req.session.username;
    const { firstName, lastName, email, phone, address, bio } = req.body;

    // Check if all required fields are present
   // const isProfileFilled = firstName && lastName && email && phone && address && bio;

    const user = await Login.findOneAndUpdate(
      { name: loggedInUserName },
      { firstName, lastName, email, phone, address, bio, },
      { new: true }
    );

    if (user) {
      res.render('sellerprofile', { layout: '/layouts/sellerLayout', user });
    } else {
      res.status(404).send('User not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating user details');
  }
});





app.get("/mylisting",isAuthenticated, async (req, res) => {
  try {
    const loggedInUserName = req.session.username;
    const products = await Product.find({ userId: loggedInUserName });

    // Prepare the data object with the products and their auctionEndTime
    const data = products.map(product => {
      const productObject = product.toObject(); // Convert Mongoose document to plain JavaScript object
      const auctionEndTime = productObject.auctionEndTime
        ? productObject.auctionEndTime.toISOString()
        : null; // Convert auctionEndTime to ISO string, or set it to null if it's undefined

      return {
        ...productObject,
        auctionEndTime
      };
    });

    res.render("mylisting", {
      layout: '/layouts/sellerLayout',
      products: data,
      title: "Products"
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching products");
  }
});

  //TO DELETE THE PRODUCT

  app.post('/deleteproduct/:productId', async (req, res) => {
    try {
      const productId = req.params.productId;
      const loggedInUserName = req.session.username;
  
      // Find the product by ID and check if it belongs to the logged-in user
      const product = await Product.findOneAndDelete({ _id: productId, userId: loggedInUserName });
  
      if (product) {
        // Product deleted successfully
        res.redirect('/mylisting');
      } else {
        // Product not found or does not belong to the logged-in user
        res.status(404).send('Product not found or you are not authorized to delete it');
      }
    } catch (err) {
      console.error(err);
      res.status(500).send('Error deleting product');
    }
  });

  app.post("/signup", async (req, res) => {
    try {
      //const { name, password, email } = req.body;
      const { name, password, email,firstName, lastName, phone, address, bio } = req.body;
      
      // Check if the username already exists
      const existingUserByName = await Login.findOne({ name });
      if (existingUserByName) {
        return res.render("signup", { usernameError: "Username is already taken" });
      }
  
      // Check if the email already exists
      const existingUserByEmail = await Login.findOne({ email });
      if (existingUserByEmail) {
        return res.render("signup", { emailError: "Email is already taken" });
      }
      const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.*[a-zA-Z]).{7,}$/;
      if (!passwordRegex.test(password)) {
        return res.render("signup",{passwordError:"Password must contain at least one capital letter, one special character, one letter, and be at least 7 characters long."});
      }
      
       // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create a new user if username and email are available
      const data = { name:name,
        password:hashedPassword,
        email: email,firstName:firstName,lastName:lastName,phone:phone,address:address,bio:bio };
      await Login.insertMany([data]);
  
      res.render("login");
    } catch (err) {
      console.error(err);
      res.status(500).send("Error signing up");
    }
  });

app.post("/login", async (req, res) => {
  try {
    const { name, password } = req.body;
    const user = await Login.findOne({ name : name });

    if (user) {
      // Store username in the session
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        req.session.username = user.name;
        res.render("sellorbuy", { username: user.name });
      } else {
      return res.render("login",{passError:"incorrect password"});
      } 
    } 
    else{
      return res.render("login",{credentialError:"wrong credentials"});
      }
    
  } 
  catch {
  res.send("wrong ")
     
  }
});

//to store image using multer
var Storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  }
});

var upload = multer({
  storage: Storage
}).array('files', 3); // Allow up to 3 file uploads




app.post("/addproducts", upload, async (req, res) => {
  const loggedInUserName = req.session.username;
  const user = await Login.findOne({ name: loggedInUserName });
  
  const auctionStartTime = new Date(req.body.auction_start_time);
    const auctionDuration = req.body.auction_duration; // Get the auction duration from the form data
    const auctionEndTime = new Date(auctionStartTime.getTime() + auctionDuration * 60 * 60 * 1000); // Calculate the auction end time in milliseconds

    const startingBid = req.body.starting_bid; // Get the starting bid from the form data
    
  const data1 = {
    productid: req.body.product_id,
    productname: req.body.product_name,
    productdescription: req.body.product_description,
    productcatogery: req.body.product_category,
    producttype: req.body.product_type,
    comment: req.body.comment,
    
    images: req.files.map((file) => file.filename), // Store the filenames in the images array
    userId: loggedInUserName,
    startingBid: startingBid, // Include the startingBid value
    minimum_bid_increment: req.body.minimum_bid_increment,
    auctionStartTime,
    auctionEndTime,
    userId: loggedInUserName,
  };
  console.log(data1);
  await Product.insertMany([data1]);

  const products = await Product.find({ userId: loggedInUserName });

  // Prepare the data object with the products and their auctionEndTime
  const data = products.map(product => {
    const productObject = product.toObject(); // Convert Mongoose document to plain JavaScript object
    const auctionEndTime = productObject.auctionEndTime
      ? productObject.auctionEndTime.toISOString()
      : null; // Convert auctionEndTime to ISO string, or set it to null if it's undefined

    return {
      ...productObject,
      auctionEndTime
    };
  });

  res.render("mylisting", {
    layout: '/layouts/sellerLayout',
    products: data,
    title: "Products"
  });

  
});

app.get('/auctionsended', isAuthenticated, async (req, res) => {
  try {
    const loggedInUserName = req.session.username;
    const now = new Date();
    const endedProducts = await Product.find({
      userId: loggedInUserName,
      auctionEndTime: { $lt: now }, // Check if auctionEndTime is in the past
      winner: { $exists: true }, // And the winner exists
    });

    const endedProductsWithBuyerDetails = await Promise.all(
      endedProducts.map(async (product) => {
        const buyer = await Login.findOne({ name: product.winner });
        return {
          ...product.toObject(),
          buyer: buyer
            ? {
                name: `${buyer.firstName} ${buyer.lastName}`,
                email: buyer.email,
                phone: buyer.phone,
                address: buyer.address,
              }
            : null,
        };
      })
    );

    res.render('auctionsended', {
      layout: '/layouts/sellerLayout',
      endedProducts: endedProductsWithBuyerDetails,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching ended products');
  }
});


/*                     BUYER                */
 


app.get('/buyer', isAuthenticated, async (req, res) => {
  try {
    const now = new Date();
    const liveProducts = await Product.find({
      auctionStartTime: { $lte: now },
      auctionEndTime: { $gt: now },
    });
    const endedProducts = await Product.find({
      auctionEndTime: { $lt: now },
      winner: { $exists: true },
    });
    const upcomingProducts = await Product.find({
      auctionStartTime: { $gt: now },
    });
    res.render('buyer', { layout: '/layouts/buyerLayout', liveProducts, endedProducts,upcomingProducts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching products');
  }
});
app.get('/product/:productId', isAuthenticated,async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findById(productId);

    if (product) {
      const seller=await Login.findOne({name:product.userId})
      res.render('productDetails', { layout: '/layouts/buyerLayout', product ,seller});
    } else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching product details');
  }
});
 
/* BIDDING CONCEPT*/
app.post('/bid/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    const bidAmount = req.body.bidAmount;
    const loggedInUserName = req.session.username;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send('Product not found');
    }

    // Check if auction started
    const now1 = new Date();
    if (now1 < product.auctionStartTime) {
      return res.status(400).send('Auction has not started yet');
    }

    // Ensure that the seller cannot bid for their own product
    if (product.userId === loggedInUserName) {
      return res.status(400).send('You cannot bid on your own product');
    }

    const now = new Date();
    if (now >= product.auctionEndTime) {
      return res.status(400).send('Auction has ended');
    }

    const minimumBidAmount = product.highestBid
      ? product.highestBid + product.minimum_bid_increment
      : product.startingBid;

    if (bidAmount < minimumBidAmount) {
      return res.status(400).send(`Bid amount should be at least $${minimumBidAmount}`);
    }

    product.highestBid = bidAmount;
    product.highestBidder = loggedInUserName;
    await product.save();

    // Check if a bid document already exists for the same user and product
    const existingBid = await Bid.findOne({ userId: loggedInUserName, productId: product._id });

    if (existingBid) {
      // Update the existing bid document
      existingBid.bidAmount = bidAmount;
      existingBid.currentHighestBid = product.highestBid;
      await existingBid.save();
    } else {
      // Create a new bid document
      const bidDetails = new Bid({
        userId: loggedInUserName,
        productId: product._id,
        productName: product.productname,
        bidAmount,
        currentHighestBid: product.highestBid,
        auctionEndTime: product.auctionEndTime,
      });
      await bidDetails.save();
    }

    res.status(200).send('Bid placed successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error placing bid');
  }
});

//to list the bids by respective user in their mybiddings.hbs

app.get('/mybiddings', isAuthenticated, async (req, res) => {
  try {
    const loggedInUserName = req.session.username;
    const bids = await Bid.find({ userId: loggedInUserName }).sort({ bidTime: -1 });

    // Fetch the latest product details for each bid
    const bidsWithUpdatedProducts = await Promise.all(
      bids.map(async (bid) => {
        const product = await Product.findById(bid.productId);
        return {
          ...bid.toObject(),
          currentHighestBid: product?.highestBid, // Use optional chaining
        };
      })
    );

    res.render('mybiddings', { layout: '/layouts/buyerLayout', bids: bidsWithUpdatedProducts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching bidding history');
  }
});

//to display all bids won by user in winbids.hbs
app.get('/bidwins',isAuthenticated, async (req, res) => {
  try {
    const loggedInUserName = req.session.username;
    const wonProducts = await Product.find({ winner: loggedInUserName });

    const wonProductsWithSellerDetails = await Promise.all(
      wonProducts.map(async (product) => {
        const seller = await Login.findOne({ name: product.userId });
        return {
          ...product.toObject(),
          seller: seller
            ? {
                firstName: seller.firstName,
                lastName: seller.lastName,
                address: seller.address,
                phone: seller.phone,
                email: seller.email,
              }
            : null,
        };
      })
    );

    res.render('bidwins', {
      layout: '/layouts/buyerLayout',
      wonProducts: wonProductsWithSellerDetails,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching won products');
  }
});

//to get coresponding profile page for each buyer

app.get('/buyerprofile',isAuthenticated, async (req, res) => {
  try {
    const loggedInUserName = req.session.username;
    const user = await Login.findOne({ name: loggedInUserName });
    const popupMessage = req.query.popupMessage
    if (user) {
      res.render('buyerprofile', { layout: '/layouts/buyerLayout', user , popupMessage  });
    } else {
      res.status(404).send('User not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching user details');
  }
});

app.post('/buyerprofile', async (req, res) => {
  try {
    const loggedInUserName = req.session.username;
    const { firstName, lastName, email, phone, address, bio } = req.body;

    // Check if all required fields are present
   // const isProfileFilled = firstName && lastName && email && phone && address && bio;

    const user = await Login.findOneAndUpdate(
      { name: loggedInUserName },
      { firstName, lastName, email, phone, address, bio, },
      { new: true }
    );

    if (user) {
      res.render('buyerprofile', { layout: '/layouts/buyerLayout', user });
    } else {
      res.status(404).send('User not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating user details');
  }
});







//highestbidder when time ends=auction winner
async function updateAuctionWinner() {
  try {
    const now = new Date();
    const expiredAuctions = await Product.find({
      auctionEndTime: { $lt: now },
      auctionStartTime: { $exists: true }, // Add this condition to filter out documents without auctionStartTime
    });

    for (const auction of expiredAuctions) {
      if (auction.highestBidder) {
        auction.winner = auction.highestBidder;
        await auction.save();
      }
    }

    console.log(`Updated ${expiredAuctions.length} expired auctions.`);
  } catch (err) {
    console.error('Error updating auction winner:', err);
  }
}

// Schedule the updateAuctionWinner function to run every minute
cron.schedule('* * * * *', updateAuctionWinner);




app.listen(3000,()=>{
    console.log("port connected")
})