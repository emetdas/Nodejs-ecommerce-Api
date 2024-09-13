const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { error } = require("console");

// Multer configuration for image uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed (JPEG,PNG,JPG,GIF)"));
    }
  },
});

// GET all products
router.get("/", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM products");
    res.json(results);
  } catch (err) {
    console.error("Error fetching products:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch products from the database" });
  }
});
// GET a single product by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query("SELECT * FROM products WHERE id = ?", [
      id,
    ]);

    if (result.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result[0]);
  } catch (err) {
    console.error("Error fetching product:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch product from the database" });
  }
});

// POST create a new product with multiple image uploads
router.post("/", upload.array("images", 5), async (req, res) => {
  const { name, description, price, quantity } = req.body;
  const images = req.files.map((file) => `/uploads/${file.filename}`);

  try {
    const [result] = await db.query(
      "INSERT INTO products (name,description,price,images,quantity) VALUES (?,?,?,?,?)",
      [name, description, price, JSON.stringify(images), quantity]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    req.files.forEach((file) => {
      fs.unlink(`/uploads/${file.filename}`, (unlinkErr) => {
        if (unlinkErr) console.error("Failed to delete file:", unlinkErr);
      });
    });

    console.error("Database query failed:", err);
    res
      .status(500)
      .json({ error: "Failed to save product. Database error occurred" });
  }
});
// PATCH update product
router.patch("/:id", upload.array("images", 5), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, quantity } = req.body;
  let images;

  try {
    const [fetchResult] = await db.query(
      "SELECT * FROM products WHERE id = ?",
      [id]
    );

    if (fetchResult.length === 0) {
      return res.status(400).json({ error: "Product not found" });
    }
    const currentProduct = fetchResult[0];
    const currentImages = JSON.parse(currentProduct.images); // Existing images

    // If new images are uploaded, handle the new images
    if (req.files.length > 0) {
      images = req.files.map((file) => `/uploads/${file.filename}`);

      // Delete old images from the server
      currentImages.forEach((imagePath) => {
        const imageFilePath = path.join(__dirname, "..", imagePath);
        fs.unlink(imageFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error(
              "Failed to delete old image:",
              imageFilePath,
              unlinkErr
            );
          } else {
            console.log("Delete old image:", imageFilePath);
          }
        });
      });
    } else {
      images = currentImages; // Keep old images if no new ones are uploaded
    }

    // Update only the provided fields
    const updatedProduct = {
      name: name || currentProduct.name,
      description: description || currentProduct.description,
      price: price || currentProduct.price,
      quantity: quantity || currentProduct.quantity,
      images: JSON.stringify(images),
    };

    await db.query(
      "UPDATE products SET name = ?, description = ?, price = ?, quantity = ? ,images = ? WHERE id = ?",
      [
        updatedProduct.name,
        updatedProduct.description,
        updatedProduct.price,
        updatedProduct.quantity,
        updatedProduct.images,
        id,
      ]
    );

    res.json({ message: "Product updated successfully" });
  } catch (err) {
    console.error("Database query failed:", err);

    // Clean up newly uploaded images if something fails
    if (req.files.length > 0) {
      req.files.forEach((file) => {
        const imageFilePath = path.join(
          __dirname,
          "..",
          "uploads",
          file.filename
        );

        fs.unlink(imageFilePath, (unlinkErr) => {
          if (unlinkErr)
            console.error("Failed to delete uploaded file:", unlinkErr);
        });
      });
    }

    res
      .status(500)
      .json({ error: "Failed to update product. Database error occurred" });
  }
});

// DELETE a update product and associated images
router.delete("/:id", upload.array("images", 5), async (req, res) => {
  const { id } = req.params;

  try {
    const [fetchResult] = await db.query(
      "SELECT * FROM products WHERE id = ?",
      [id]
    );

    if (fetchResult.length === 0) {
      return res.status(400).json({ error: "Product not found" });
    }
    let images = fetchResult[0].images;

    try {
      images = JSON.parse(images);
    } catch (err) {
      console.error("Failed to parse images", err);
      return res.status(500).json({ error: "Failed to parse images" });
    }

    if (Array.isArray(images)) {
      images.forEach((imagePath) => {
        const imageFilePath = path.join(__dirname, "..", imagePath);
        fs.unlink(imageFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Failed to delete image:", imageFilePath, unlinkErr);
          }
        });
      });
    }

    await db.query("DELETE FROM products WHERE id = ?", [id]);
    res.json({ message: "Product and associated images deleted successfully" });
  } catch (err) {
    console.error("Database query failed:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

module.exports = router;
