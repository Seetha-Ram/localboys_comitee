const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   DATABASE CONNECTION
========================================================= */

if (!process.env.DATABASE_URL) {
  console.error("");
  console.error("ERROR: DATABASE_URL is not set.");
  console.error("");
  console.error("Windows CMD:");
  console.error("set DATABASE_URL=your-postgresql-url");
  console.error("");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true
  })
);

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {
  try {
    console.log("Connecting to PostgreSQL...");

    await pool.query("SELECT NOW()");

    console.log("PostgreSQL connected.");

    /* -------------------------
       CHANDA TABLE
    ------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chanda (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        devotee_name VARCHAR(150) NOT NULL,
        amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    /* -------------------------
       EXPENSE TABLE
    ------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        expense_name VARCHAR(150) NOT NULL,
        amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Database tables ready.");
  } catch (error) {
    console.error("");
    console.error("DATABASE ERROR:");
    console.error(error.message);
    console.error("");
    process.exit(1);
  }
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      message: "Local Boys Chanda server is running",
      database: "connected"
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message
    });
  }
});

/* =========================================================
   CHANDA API
========================================================= */

/*
   GET ALL CHANDA
*/

app.get("/api/chanda", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        devotee_name,
        amount,
        category,
        created_at
      FROM chanda
      ORDER BY date DESC, id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("GET /api/chanda error:", error);

    res.status(500).json({
      error: "Unable to load chanda records."
    });
  }
});

/*
   ADD CHANDA
*/

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
        error: "Please fill all chanda fields."
      });
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      return res.status(400).json({
        error: "Amount must be a valid number."
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
        category,
        created_at
      `,
      [
        date,
        String(devotee_name).trim(),
        numericAmount,
        String(category).trim()
      ]
    );

    res.status(201).json({
      success: true,
      message: "Chanda added successfully.",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("POST /api/chanda error:", error);

    res.status(500).json({
      error: "Unable to add chanda."
    });
  }
});

/*
   UPDATE CHANDA
*/

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
        error: "Please fill all chanda fields."
      });
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      return res.status(400).json({
        error: "Amount must be a valid number."
      });
    }

    const result = await pool.query(
      `
      UPDATE chanda
      SET
        date = $1,
        devotee_name = $2,
        amount = $3,
        category = $4
      WHERE id = $5
      RETURNING
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        devotee_name,
        amount,
        category,
        created_at
      `,
      [
        date,
        String(devotee_name).trim(),
        numericAmount,
        String(category).trim(),
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Chanda record not found."
      });
    }

    res.json({
      success: true,
      message: "Chanda updated successfully.",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("PUT /api/chanda error:", error);

    res.status(500).json({
      error: "Unable to update chanda."
    });
  }
});

/*
   DELETE CHANDA
*/

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
    console.error("DELETE /api/chanda error:", error);

    res.status(500).json({
      error: "Unable to delete chanda."
    });
  }
});

/* =========================================================
   EXPENSE API
========================================================= */

/*
   GET ALL EXPENSES
*/

app.get("/api/expenses", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        expense_name,
        amount,
        category,
        created_at
      FROM expenses
      ORDER BY date DESC, id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("GET /api/expenses error:", error);

    res.status(500).json({
      error: "Unable to load expenses."
    });
  }
});

/*
   ADD EXPENSE
*/

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
        error: "Please fill all expense fields."
      });
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      return res.status(400).json({
        error: "Amount must be a valid number."
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
        category,
        created_at
      `,
      [
        date,
        String(expense_name).trim(),
        numericAmount,
        String(category).trim()
      ]
    );

    res.status(201).json({
      success: true,
      message: "Expense added successfully.",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("POST /api/expenses error:", error);

    res.status(500).json({
      error: "Unable to add expense."
    });
  }
});

/*
   UPDATE EXPENSE
*/

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
        error: "Please fill all expense fields."
      });
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      return res.status(400).json({
        error: "Amount must be a valid number."
      });
    }

    const result = await pool.query(
      `
      UPDATE expenses
      SET
        date = $1,
        expense_name = $2,
        amount = $3,
        category = $4
      WHERE id = $5
      RETURNING
        id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        expense_name,
        amount,
        category,
        created_at
      `,
      [
        date,
        String(expense_name).trim(),
        numericAmount,
        String(category).trim(),
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Expense record not found."
      });
    }

    res.json({
      success: true,
      message: "Expense updated successfully.",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("PUT /api/expenses error:", error);

    res.status(500).json({
      error: "Unable to update expense."
    });
  }
});

/*
   DELETE EXPENSE
*/

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
    console.error("DELETE /api/expenses error:", error);

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
    /*
       TOTAL CHANDA
    */

    const totalChandaResult = await pool.query(`
      SELECT
        COALESCE(SUM(amount), 0) AS total
      FROM chanda
    `);

    /*
       TOTAL EXPENSES
    */

    const totalExpensesResult = await pool.query(`
      SELECT
        COALESCE(SUM(amount), 0) AS total
      FROM expenses
    `);

    /*
       CHANDA BY CATEGORY
    */

    const chandaCategoryResult = await pool.query(`
      SELECT
        category,
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS entries
      FROM chanda
      GROUP BY category
      ORDER BY total DESC
    `);

    /*
       EXPENSES BY CATEGORY
    */

    const expenseCategoryResult = await pool.query(`
      SELECT
        category,
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS entries
      FROM expenses
      GROUP BY category
      ORDER BY total DESC
    `);

    /*
       MONTHLY CHANDA
    */

    const monthlyChandaResult = await pool.query(`
      SELECT
        TO_CHAR(date, 'YYYY-MM') AS month,
        COALESCE(SUM(amount), 0) AS total
      FROM chanda
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month DESC
    `);

    /*
       MONTHLY EXPENSES
    */

    const monthlyExpensesResult = await pool.query(`
      SELECT
        TO_CHAR(date, 'YYYY-MM') AS month,
        COALESCE(SUM(amount), 0) AS total
      FROM expenses
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month DESC
    `);

    const totalChanda =
      Number(totalChandaResult.rows[0].total);

    const totalExpenses =
      Number(totalExpensesResult.rows[0].total);

    const balance =
      totalChanda - totalExpenses;

    res.json({
      success: true,

      totalChanda,

      totalExpenses,

      balance,

      chandaByCategory:
        chandaCategoryResult.rows,

      expensesByCategory:
        expenseCategoryResult.rows,

      monthlyChanda:
        monthlyChandaResult.rows,

      monthlyExpenses:
        monthlyExpensesResult.rows
    });

  } catch (error) {
    console.error("GET /api/dashboard error:", error);

    res.status(500).json({
      error: "Unable to load dashboard."
    });
  }
});

/* =========================================================
   SIMPLE TOTALS API
========================================================= */

app.get("/api/totals", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM chanda)
          AS total_chanda,

        (SELECT COALESCE(SUM(amount), 0) FROM expenses)
          AS total_expenses
    `);

    const totalChanda =
      Number(result.rows[0].total_chanda);

    const totalExpenses =
      Number(result.rows[0].total_expenses);

    res.json({
      totalChanda,
      totalExpenses,
      balance: totalChanda - totalExpenses
    });

  } catch (error) {
    console.error("GET /api/totals error:", error);

    res.status(500).json({
      error: "Unable to calculate totals."
    });
  }
});

/* =========================================================
   CATEGORY LIST
========================================================= */

app.get("/api/categories", async (req, res) => {
  try {
    const chandaCategories = await pool.query(`
      SELECT DISTINCT category
      FROM chanda
      WHERE category IS NOT NULL
        AND category <> ''
      ORDER BY category
    `);

    const expenseCategories = await pool.query(`
      SELECT DISTINCT category
      FROM expenses
      WHERE category IS NOT NULL
        AND category <> ''
      ORDER BY category
    `);

    res.json({
      chandaCategories:
        chandaCategories.rows.map(row => row.category),

      expenseCategories:
        expenseCategories.rows.map(row => row.category)
    });

  } catch (error) {
    console.error("GET /api/categories error:", error);

    res.status(500).json({
      error: "Unable to load categories."
    });
  }
});

/* =========================================================
   FRONTEND FALLBACK
========================================================= */

/*
   Express 5 does not support app.get("*").
   This middleware handles normal browser requests
   and sends the frontend index.html.
*/

app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {
    return res.sendFile(
      path.join(__dirname, "public", "index.html")
    );
  }

  next();
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  res.status(500).json({
    error: "Internal server error."
  });
});

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log("");
    console.log("========================================");
    console.log("       LOCAL BOYS CHANDA");
    console.log("========================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`Local URL: http://localhost:${PORT}`);
    console.log("========================================");
    console.log("");
  });
}

startServer();
