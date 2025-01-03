import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config()

const pool = new Pool({
  user: process.env.user,
  host: process.env.host,
  database: process.env.database,
  password: process.env.password,
  port:process.env.port? parseInt(process.env.port):undefined
  
})

export default pool

