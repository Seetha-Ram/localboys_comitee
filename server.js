const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

console.log("Connecting to PostgreSQL...");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
   index.html is in the SAME folder as server.js
*/
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chanda (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        devotee_name VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        expense_name VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Database tables ready.");
  } catch (error) {
    console.error("\nDATABASE ERROR:");
    console.error(error.message);
    process.exit(1);
  }
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: "disconnected"
    });
  }
});


/* =========================================================
   CHANDA - GET ALL
========================================================= */

app.get("/api/chanda", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        devotee_name,
        amount,
        category
      FROM chanda
      ORDER BY date DESC, id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("GET CHANDA ERROR:", error.message);

    res.status(500).json({
      error: "Unable to load chanda records."
    });
  }
});


/* =========================================================
   CHANDA - ADD
========================================================= */

app.post("/api/chanda", async (req, res) => {
  try {
    const {
      date,
      devotee_name,
      amount,
      category
    } = req.body;

    if (
      !date ||
      !devotee_name ||
      amount === undefined ||
      amount === null ||
      !category
    ) {
      return res.status(400).json({
        error: "All fields are required."
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        error: "Amount must be a valid positive number."
      });
    }

    const result = await pool.query(
      `
      INSERT INTO chanda
        (date, devotee_name, amount, category)
      VALUES
        ($1, $2, $3, $4)
      RETURNING
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        devotee_name,
        amount,
        category
      `,
      [
        date,
        devotee_name.trim(),
        numericAmount,
        category
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("ADD CHANDA ERROR:", error.message);

    res.status(500).json({
      error: "Unable to add chanda."
    });
  }
});


/* =========================================================
   CHANDA - UPDATE
========================================================= */

app.put("/api/chanda/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: "Invalid chanda ID."
      });
    }

    const {
      date,
      devotee_name,
      amount,
      category
    } = req.body;

    if (
      !date ||
      !devotee_name ||
      amount === undefined ||
      amount === null ||
      !category
    ) {
      return res.status(400).json({
        error: "All fields are required."
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        error: "Amount must be a valid positive number."
      });
    }

    const result = await pool.query(
      `
      UPDATE chanda
      SET
        date = $1,
        devotee_name = $2,
        amount = $3,
        category = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        devotee_name,
        amount,
        category
      `,
      [
        date,
        devotee_name.trim(),
        numericAmount,
        category,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Chanda record not found."
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("UPDATE CHANDA ERROR:", error.message);

    res.status(500).json({
      error: "Unable to update chanda."
    });
  }
});


/* =========================================================
   CHANDA - DELETE
========================================================= */

app.delete("/api/chanda/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: "Invalid chanda ID."
      });
    }

    const result = await pool.query(
      `
      DELETE FROM chanda
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Chanda record not found."
      });
    }

    res.json({
      success: true,
      message: "Chanda deleted successfully."
    });
  } catch (error) {
    console.error("DELETE CHANDA ERROR:", error.message);

    res.status(500).json({
      error: "Unable to delete chanda."
    });
  }
});


/* =========================================================
   EXPENSES - GET ALL
========================================================= */

app.get("/api/expenses", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        expense_name,
        amount,
        category
      FROM expenses
      ORDER BY date DESC, id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("GET EXPENSES ERROR:", error.message);

    res.status(500).json({
      error: "Unable to load expense records."
    });
  }
});


/* =========================================================
   EXPENSE - ADD
========================================================= */

app.post("/api/expenses", async (req, res) => {
  try {
    const {
      date,
      expense_name,
      amount,
      category
    } = req.body;

    if (
      !date ||
      !expense_name ||
      amount === undefined ||
      amount === null ||
      !category
    ) {
      return res.status(400).json({
        error: "All fields are required."
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        error: "Amount must be a valid positive number."
      });
    }

    const result = await pool.query(
      `
      INSERT INTO expenses
        (date, expense_name, amount, category)
      VALUES
        ($1, $2, $3, $4)
      RETURNING
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        expense_name,
        amount,
        category
      `,
      [
        date,
        expense_name.trim(),
        numericAmount,
        category
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("ADD EXPENSE ERROR:", error.message);

    res.status(500).json({
      error: "Unable to add expense."
    });
  }
});


/* =========================================================
   EXPENSE - UPDATE
========================================================= */

app.put("/api/expenses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: "Invalid expense ID."
      });
    }

    const {
      date,
      expense_name,
      amount,
      category
    } = req.body;

    if (
      !date ||
      !expense_name ||
      amount === undefined ||
      amount === null ||
      !category
    ) {
      return res.status(400).json({
        error: "All fields are required."
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        error: "Amount must be a valid positive number."
      });
    }

    const result = await pool.query(
      `
      UPDATE expenses
      SET
        date = $1,
        expense_name = $2,
        amount = $3,
        category = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        expense_name,
        amount,
        category
      `,
      [
        date,
        expense_name.trim(),
        numericAmount,
        category,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Expense record not found."
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("UPDATE EXPENSE ERROR:", error.message);

    res.status(500).json({
      error: "Unable to update expense."
    });
  }
});


/* =========================================================
   EXPENSE - DELETE
========================================================= */

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        error: "Invalid expense ID."
      });
    }

    const result = await pool.query(
      `
      DELETE FROM expenses
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Expense record not found."
      });
    }

    res.json({
      success: true,
      message: "Expense deleted successfully."
    });
  } catch (error) {
    console.error("DELETE EXPENSE ERROR:", error.message);

    res.status(500).json({
      error: "Unable to delete expense."
    });
  }
});


/* =========================================================
   DASHBOARD
========================================================= */

app.get("/api/dashboard", async (req, res) => {
  try {

    const totalsResult = await pool.query(`
      SELECT
        COALESCE(
          (SELECT SUM(amount) FROM chanda),
          0
        ) AS total_chanda,

        COALESCE(
          (SELECT SUM(amount) FROM expenses),
          0
        ) AS total_expenses
    `);


    const chandaCategoryResult = await pool.query(`
      SELECT
        category,
        COALESCE(SUM(amount), 0) AS total
      FROM chanda
      GROUP BY category
      ORDER BY category
    `);


    const expenseCategoryResult = await pool.query(`
      SELECT
        category,
        COALESCE(SUM(amount), 0) AS total
      FROM expenses
      GROUP BY category
      ORDER BY category
    `);


    const totals =
      totalsResult.rows[0];


    const totalChanda =
      Number(totals.total_chanda || 0);


    const totalExpenses =
      Number(totals.total_expenses || 0);


    const balance =
      totalChanda - totalExpenses;


    res.json({
      totalChanda,
      totalExpenses,
      balance,

      chandaByCategory:
        chandaCategoryResult.rows.map(row => ({
          category: row.category,
          total: Number(row.total || 0)
        })),

      expensesByCategory:
        expenseCategoryResult.rows.map(row => ({
          category: row.category,
          total: Number(row.total || 0)
        }))
    });

  } catch (error) {

    console.error(
      "DASHBOARD ERROR:",
      error.message
    );

    res.status(500).json({
      error: "Unable to load dashboard."
    });

  }
});


/* =========================================================
   404 API HANDLER
========================================================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API endpoint not found."
  });
});


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {

  console.error(
    "SERVER ERROR:",
    err
  );

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Internal server error."
  });

});


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

  await initializeDatabase();

  app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("========================================");
    console.log("       LOCAL BOYS CHANDA");
    console.log("========================================");
    console.log(`Server running on port ${PORT}`);

    if (PORT === 3000) {
      console.log(
        "Local URL: http://localhost:3000"
      );
    }

    console.log("========================================");
    console.log("");

  });

}


startServer();
