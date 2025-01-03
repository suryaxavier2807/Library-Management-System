import { JwtPayload } from "jsonwebtoken"
import { Request } from "express"

export interface User{
    username:string,
    email:string,
    password:string

}

export interface CustomRequest extends Request {
    token: string | JwtPayload
}

export interface BorrowRequest{
    bookId:number,
    userId:number,
    fromDate:string,
    toDate:string
}

export interface ApproveBorrowRequest{
    borrowRequestId:number,
    isApproved:boolean
}

export interface BorrowHistory{
    userId:number
}