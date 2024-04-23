const mongoose=require("mongoose")

mongoose.connect("mongodb+srv://abhinavsunilvra59:12345@cluster0.dyilzjg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
.then(()=>{
    console.log("mongodb connected");
})
.catch(()=>{
    console.log("failed to connect");
})



const loginSchema = new mongoose.Schema({
    name: { type: String, required: true,unique:true },
    password: { type: String, required: true },
    email: { type: String, required: true,unique:true },
    firstName: String,
    lastName: String,
    phone: String,
    address: String,
    bio: String,
    
  });

  const productSchema = new mongoose.Schema({
    productid: { type: String, required: true },
    productname: { type: String, required: true },
    productdescription: { type: String, required: true },
    productcatogery: { type: String, required: true },
    producttype: { type: String, required: true },
    comment: { type: String },
    images: [String], // Array to store multiple image paths
    userId: { type: String, required: true },
    startingBid: { type: Number, required: true },
    highestBid: { type: Number, default: 0 },
    highestBidder: { type: String, default: null },
    minimum_bid_increment:{type:Number,required:true},
    auctionStartTime: { type: Date, required: true },
    auctionEndTime: { type: Date, required: true },
    winner: { type: String, default: null },
  });
  const bidSchema = new mongoose.Schema({
    userId: String,
    productId: String,
    productName: String,
    bidAmount: Number,
    bidTime: { type: Date, default: Date.now },
    currentHighestBid: Number,
    auctionEndTime: Date,
  });
  
  const Bid = mongoose.model('Bid', bidSchema);
  

 const Login =  mongoose.model("Login",loginSchema)
 const Product = mongoose.model('Product', productSchema);

 module.exports = { Product, Login, Bid };