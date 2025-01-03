import { Request, Response, Router } from "express";
const router = Router();
import pool from "../db/db";
import { ApproveBorrowRequest, BorrowHistory, User } from "../types/types";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";

// gets all the users
router.get("/getAllUsers", async (req, res) => {
  let client;

  try {
    client = await pool.connect(); // Get a client from the pool
    console.log("Connected to the database");

    const dbResult = await client.query("SELECT * FROM users"); // Perform a query

    if (dbResult.rows.length < 1) {
      res.status(404).json("No users found");
      return;
    }

    res.status(200).json(dbResult.rows); // Send data back to the client
    return;
  } catch (err) {
    console.error("Error connecting to the database", err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (client) client.release(); // Release the client back to the pool
  }
});

// the admin can create a user
router.post("/createUser", async (req: Request<{}, {}, User>, res: Response) => {
    let client;

    try {
      const user: User = req.body;

      client = await pool.connect();
      const query =
        "INSERT INTO users (username,email,password) VALUES ($1,$2,$3)";

      const hashedPassword = await bcrypt.hash(user.password, 10);
      console.log(hashedPassword, "hashedpass");

      const values = [user.username, user.email, hashedPassword];
      const result = await client.query(query, values);

      if (result.rowCount && result.rowCount < 1) {
        res.status(400).json("Unable to create User");
        return;
      }

      res.status(200).json("User created successfully");
      return;
    } catch (error) {
      console.error("Error connecting to the database", error);
      res.status(500).send("Internal Server Error");
      return;
    } finally {
      if (client) client.release();
    }
  }
);

// The admin can get all the book requests submitted by the user
router.get("/getBookRequests", async (req: Request, res: Response) => {
  let client;
  try {
    client = await pool.connect(); // Get a client from the pool

    const dbResult =
      await client.query(`select c.borrowRequestId, u.username, b.bookName, c.fromDate, c.toDate,c.isapproved from borrowRequests c
                          left join users u on c.userId = u.userId left join books b
                           on b.bookId = c.bookId`);

    if (dbResult.rows.length < 1) {
      res.status(404).json("No Book Requests found");
      return;
    }

    res.status(200).json(dbResult.rows); // Send data back to the client
    return;

  } catch (err) {
    console.error("Error connecting to the database", err);
    res.status(500).send("Internal Server Error");
    
  } finally {
    if (client) client.release(); // Release the client back to the pool
  }
});


// The admin can either approve or reject requests
router.post("/approveBookRequests", async (req: Request<{},{},ApproveBorrowRequest>, res: Response) => {
  let client;

  //If the admin rejects the request then just reject the borrow request
  try {
    client = await pool.connect(); // Get a client from the pool
    
    if(!req.body.isApproved){
    
     const query = `
      UPDATE borrowRequests 
      SET isApproved = false 
      WHERE borrowRequestId = $1
      RETURNING *
     `

     const dbResult = await client.query(query,[req.body.borrowRequestId]);
     
     
    
     if(dbResult.rowCount && dbResult.rowCount < 1){
      res.status(404).json("Failed to deny Request")
      return;
     }

     res.status(200).json("Book Request Denied")
      return;
    
    }
    

    // If the admin approves the request, then first check if the new request overlaps any existing request
    // If not overlapping then approve the request, update the book status and also add it to to the borror history

    
    
    const getBookIdQuery = await client.query('SELECT * from borrowRequests where borrowRequestId = $1 ',[req.body.borrowRequestId])
    const bookId = getBookIdQuery.rows[0].bookid

    const checkOverlapQuery = 'SELECT * from borrowHistory where bookId = $1 AND NOT(toDate < $2 or fromDate > $3)'
    const overlapValues = [bookId, getBookIdQuery.rows[0].fromdate, getBookIdQuery.rows[0].todate]
    const checkOverlap = await client.query(checkOverlapQuery,overlapValues)
    console.log(checkOverlap.rows,"res");
    
    if(checkOverlap.rows.length > 0){
      res.status(200).json("Book is currently borrowed")
      return
    }


    const bookStatus = await client.query('SELECT * FROM books where bookId = $1',[bookId])
    
    if(bookStatus.rows[0].isoccupied){
      res.status(404).json("Book is currently unavailable")
      return
    }
    


    const updateBookAndBorrowHistory = ` WITH updated_borrow_request AS (
     UPDATE borrowRequests 
      SET isApproved = true 
      WHERE borrowRequestId = $1
      RETURNING bookId, userId, fromDate, toDate 
    ),
    updated_books AS (
    UPDATE books 
    SET isOccupied = true 
    WHERE bookId = (SELECT bookId FROM updated_borrow_request)
    RETURNING *
    )
    INSERT INTO borrowHistory (bookId, userId, fromDate, toDate)
    SELECT bookId, userId, fromDate, toDate FROM updated_borrow_request
    RETURNING * `

    
    const result = await client.query(updateBookAndBorrowHistory,[req.body.borrowRequestId])
    if(result.rowCount && result.rowCount < 1){
         console.log("Failed to Update Book Status and Borrow History")
    }                                                 
                                                       
    
    res.status(200).json("Book Request approved successfully")
    return

  } catch (err) {
    console.error("Error connecting to the database", err);
    res.status(500).send("Internal Server Error");
    
  } finally {
    if (client) client.release(); // Release the client back to the pool
  }
});


// the admin can check the user's book borrow history
router.post('/viewBorrowHistory', async(req:Request<{},{},BorrowHistory>, res:Response)=>{
  let client;

  try {
    client = await pool.connect()

    if(!req.body.userId){
      res.status(404).json("User ID is required")
      return
  }

    const checkUser = await client.query('SELECT * from users where userId = $1',[req.body.userId])
        if(checkUser.rows.length < 1){
            res.status(404).json("Invalid User ID")
            return
        }


    const viewHistoryQuery = await client.query(`select u.username, b.bookName, c.fromDate, c.toDate, b.bookId from borrowHistory c
       left join users u on u.userId = c.userId left join
       books b on b.bookId = c.bookId where u.userId = $1`,[req.body.userId])
    if(viewHistoryQuery.rows.length > 0){
      res.status(200).json({"Book History": viewHistoryQuery.rows})
      return
    }
    else{
      res.status(400).json({"message":"The user has not borrowed any book"})
      return    
    }   


    
  } catch (err) {
    console.error("Error connecting to the database", err);
    res.status(500).send("Internal Server Error");
    
  }
  finally{

    if(client)client.release()

  }
})



export default router;
