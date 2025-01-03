import { Request,Response,Router } from "express";
const router = Router()
import pool from "../db/db";
import bcrypt from "bcryptjs"
import jwt,{ Secret } from "jsonwebtoken";
import { User,BorrowRequest } from "../types/types";
import dotenv from "dotenv"
import auth from "../middleware/auth";
// import 'source-map-support/register'
dotenv.config()

// If the user successfully logins then send an appropriate token
router.post('/userLogin', async(req:Request<{},{},User>,res:Response)=>{
    console.log("inside user login ");
    
    let client;
    try {
        const user:User = req.body
        if(!user.username){
            res.status(400).json("Username is Required")
            return
        }
        if(!user.password){
            res.status(400).json("Password is Required")
            return
        }

        client = await pool.connect()
        
        const getQuery = 'select * from users where username = $1'
        const checkUser = await client.query(getQuery,[user.username])

        if(checkUser.rows.length < 1){
            res.status(404).json("User does not exist")
            return;
        }

        const verifyPassword = await bcrypt.compare(user.password,checkUser.rows[0].password)
        if(!verifyPassword){
            res.status(404).json("Invalid password")
            return;
        }
        
        
        const secretKey = process.env.secretKey as string
        
        const token = jwt.sign({username:user.username},secretKey,{expiresIn:'10h'})
        res.status(200).json({token:token})
        return;
        
    } catch (error) {
        console.log(error,"error");
        res.status(500).json("Internal server error")
        return
        
        
    } finally{
        if(client) client.release()
    }


})

// The user can view all the books
router.get('/getAllBooks',auth, async(req:Request,res:Response)=>{
    let client;
    try {
        client = await pool.connect()
        const result = await client.query('select * from books')

        if(result.rows.length < 1){
            res.status(400).json("Unable to fetch list of books")
            return
        }
        res.status(200).json({Books:result.rows})
        return
        
    } catch (error) {
        console.log(error,"Inside catch block");
        res.status(500).json("Internal server error")
        return
        
    } finally{
        if(client) client.release()
    }
})

// The user can submit a request to borrow a book
router.post('/borrowBook', auth, async(req:Request<{},{},BorrowRequest>,res:Response)=>{
    let client;
    try {
        const bookrequest:BorrowRequest = req.body
        client = await pool.connect()

        const checkUser = await client.query('SELECT * from users where userId = $1',[bookrequest.userId])
        if(checkUser.rows.length < 1){
            res.status(404).json("Invalid User ID")
            return
        }

        const checkBook = await client.query('SELECT * from books where bookId = $1',[bookrequest.bookId])
        if(checkBook.rows.length < 1){
            res.status(404).json("Invalid Book ID")
            return
        }

    
        const checkOverlapQuery = 'SELECT * from borrowHistory where bookId = $1 AND NOT(toDate < $2 or fromDate > $3)'
        const overlapValues = [bookrequest.bookId,bookrequest.fromDate,bookrequest.toDate]
        const checkOverlap = await client.query(checkOverlapQuery,overlapValues)
        if(checkOverlap.rows.length > 0){
          res.status(200).json("Book is currently borrowed")
          return
        }
        
        if(checkBook.rows[0].isoccupied){
            res.status(404).json({" message": "Book is not available currently"})
            return
        }

        const checkRequest = await client.query('SELECT * from borrowRequests where bookId = $1 and userId = $2',[bookrequest.bookId,bookrequest.userId])
        if(checkRequest.rows.length > 0){
            res.status(404).json("Request already submitted")
            return
        }


        

        const query = 'INSERT INTO borrowRequests (bookId,userId,fromDate,toDate) values ($1,$2,$3,$4)'
         const values = [bookrequest.bookId,bookrequest.userId,bookrequest.fromDate,bookrequest.toDate]
         const result = await client.query(query,values)
         
         
         if(result.rowCount && result.rowCount < 1){
            res.status(400).json("Unable to submit your Book request")
            return;
        }
        
        res.status(200).json("Book Request Submitted successfully")
        return;

        
    } catch (error) {
        console.log("inside catch block",error);
        res.status(500).json("Internal Server Error")
        
        
    } finally{
        if(client) client.release()
    }
})

export default router
