const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/products/", require("./routes/productRoutes"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Server Setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
