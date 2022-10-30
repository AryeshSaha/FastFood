const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const session = require("express-session");
require('dotenv').config();

mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "fastfood",
});

const app = express();

app.use(express.static("public"));

app.set("view engine", "ejs");

app.listen(process.env.PORT, () => {
  console.log(`app is listening on port ${process.env.PORT}`);
});

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({ secret: "secret", resave: true, saveUninitialized: true }));

const isProductInCart = (cart, id) => {
  // for (let i = 0; i < cart.length; i++) {
  //   if (cart[i].id == id) {
  //     return true;
  //   }
  // }

  cart.map((id) => {
    if (id.id == id) {
      return true;
    }
  });
  return false;
};

const calculateTotal = (cart, req) => {
  total = 0;
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].sale_price) {
      total = total + cart[i].sale_price * cart[i].quantity;
    } else {
      total = total + cart[i].price * cart[i].quantity;
    }
  }

  req.session.total = total;
  return total;
};

// localhost:3000
app.get("/", (req, res) => {
  const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "fastfood",
  });

  con.query("SELECT * FROM products", (err, result) => {
    res.render("pages/index", { result: result });
  });
});

// add_to_cart action
app.post("/add_to_cart", (req, res) => {
  const id = req.body.id;
  const name = req.body.name;
  const price = req.body.price;
  const sale_price = req.body.sale_price;
  const quantity = req.body.quantity;
  const image = req.body.image;
  const product = {
    id: id,
    name: name,
    price: price,
    sale_price: sale_price,
    quantity: quantity,
    image: image,
  };

  if (req.session.cart) {
    var cart = req.session.cart;
    if (!isProductInCart(cart, id)) {
      cart.push(product);
    }
  } else {
    req.session.cart = [product];
    var cart = req.session.cart;
  }

  // calculate total
  calculateTotal(cart, req);

  // return to cart page
  res.redirect("/cart");
});

app.get("/cart", (req, res) => {
  const cart = req.session.cart;
  const total = req.session.total;

  res.render("pages/cart", { cart: cart, total: total });
});

// remove_product action
app.post("/remove_product", (req, res) => {
  const id = req.body.id;
  const cart = req.session.cart;

  cart.map((item) => {
    if (item.id == id) {
      cart.splice(cart.indexOf(item), 1);
    }
  });

  // recalculate
  calculateTotal(cart, req);
  res.redirect("/cart");
});

// edit quantity

app.post("/edit_product_quantity", (req, res) => {
  // get values from inputs
  var id = req.body.id;
  var quantity = req.body.quantity;
  var increase_btn = req.body.increase_product_quantity;
  var decrease_btn = req.body.decrease_product_quantity;

  var cart = req.session.cart;

  if (increase_btn) {
    cart.map((item) => {
      if (item.id == id) {
        if (item.quantity > 0) {
          item.quantity = parseInt(item.quantity) + 1;
        }
      }
    });
  }

  if (decrease_btn) {
    cart.map((item) => {
      if (item.id == id) {
        if (item.quantity > 1) {
          item.quantity = parseInt(item.quantity) - 1;
        }
      }
    });
  }

  calculateTotal(cart, req);
  res.redirect("/cart");
});

// checkout function

app.get("/checkout", (req, res) => {
  res.render("pages/checkout");
});

app.post("/place_order", (req, res) => {
  var name = req.body.name;
  var email = req.body.email;
  var phone = req.body.phone;
  var city = req.body.city;
  var address = req.body.address;
  var cost = req.session.total;
  var status = "not paid";
  var date = new Date();
  var product_ids = "";
  var id = Date.now();
  req.session.order_id = id;

  const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "fastfood",
  });

  var cart = req.session.cart;

  cart.map((item) => {
    product_ids = product_ids + " , " + item.id;
  });

  con.connect((err) => {
    if (err) {
      alert("there's an error you should check");
      console.log("THE ERROR: " + err);
    } else {
      var query =
        "INSERT INTO  orders( id, cost, name, email, status, city, address, phone, date, product_ids ) VALUES ?";
      var values = [
        [
          id,
          cost,
          name,
          email,
          status,
          city,
          address,
          phone,
          date,
          product_ids,
        ],
      ];

      con.query(query, [values], (err, result) => {
        cart.map((item) => {
          var query =
            "INSERT INTO  order_items( order_id, product_id, product_name, product_price, product_image, product_quantity, order_date ) VALUES ?";
          var values = [
            [
              id,
              item.id,
              item.name,
              item.price,
              item.image,
              item.quantity,
              item.date,
            ],
          ];

          con.query(query, [values], (err, result) => {});
        });

        res.redirect("/payment");
      });
    }
  });
});

app.get("/payment", (req, res) => {
  var total = req.session.total;
  var sandboxId = process.env.SANDBOX_CLIENT_ID;
  res.render("pages/payment", { total: total, sandboxId: sandboxId });
});

app.get("/verify_payment", (req, res) => {
  var transaction_id = req.query.transaction_id;
  var order_id = req.session.order_id;

  var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "fastfood",
  });

  con.connect((err) => {
    if (err) {
      alert("there's an error you should check");
      console.log("THE ERROR: " + err);
    } else {
      var query =
        "INSERT INTO  payments( order_id, transaction_id, date ) VALUES ?";
      var values = [[order_id, transaction_id, new Date()]];

      con.query(query, [values], (err, result) => {
        con.query(
          "UPDATE orders SET status = 'paid' WHERE id='" + order_id + "'",
          (err, result) => {}
        );
        res.redirect("/thankyou");
      });
    }
  });
});

app.get("/thankyou", (req, res) => {
  var order_id = req.session.order_id;
  res.render("pages/thankyou", { order_id: order_id });
});


app.get('/single_product', (req, res)=>{
  var id = req.query.id;
  const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "fastfood",
  });

  con.query("SELECT * FROM products WHERE id='"+ id +"'", (err, result) => {
    res.render("pages/single_product", { result: result });
  });

})


app.get('/products', (req, res)=>{
  const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "fastfood",
  });

  con.query("SELECT * FROM products", (err, result) => {
    res.render("pages/products", { result: result });
  });
})


app.get('/about', (req, res)=>{
  res.render('pages/about')
})