import { Request,Response,NextFunction, json } from "express";
import jwt, { TokenExpiredError,JwtPayload } from "jsonwebtoken";
import { CustomRequest } from "../types/types";
import dotenv from "dotenv"
dotenv.config()


// This is an middleware to check if the user has sent an valid token
async function auth(req:Request, res:Response, next:NextFunction){

    const authorizationHeader = req.headers.authorization

    const token = authorizationHeader?.split(" ")[1]
    
    
    

    if(!token){
        
        
        res.status(404).json("Token not found")
        return

    }

    try {
        const secretKey = process.env.secretKey as string
        
        
        const verifyToken = jwt.verify(token,secretKey) as  string | JwtPayload
       
        (req as CustomRequest).token = verifyToken
        
        next();
        
        
        
    } catch (error) {
        if(error instanceof TokenExpiredError){
            res.status(404).json("Token Expired")

        }
        else{
            res.status(500).json("Internal server error")
            return

        }
        
        
        
        
    }

    


    

}



export default auth;