import express,{Request,Response } from "express";
import admin from "./controller/admin";
import user from "./controller/user"

const app = express()
const port  = 8081

app.listen(port,()=>{
    console.log(`listening to port ${port}`);
    
})
app.use(express.json())

  
app.use('/admin/',admin)
app.use('/user/',user)


