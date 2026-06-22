const mongoose=require('mongoose')

async  function connectToDB(){
    try {
        await mongoose.connect(process.env.MONGO_URI)

        console.log("Connected  to Database ")

    } catch (err) {

        console.log("Error connecting to database:", err)
    }
}
module.exports = connectToDB