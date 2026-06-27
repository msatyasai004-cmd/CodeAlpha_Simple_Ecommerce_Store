const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'ecommerce-secret-key',
    resave: false,
    saveUninitialized: true
}));

// In-Memory Database
const users = [];
const orders = [];
const products = [
    { id: 1, name: "Premium Laptop", price: 999, desc: "High performance laptop for developers.", img: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300" },
    { id: 2, name: "Wireless Headphones", price: 199, desc: "Noise-cancelling over-ear headphones.", img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300" },
    { id: 3, name: "Mechanical Keyboard", price: 89, desc: "RGB tactile mechanical keyboard.", img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=300" }
];

// Backend API Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (users.find(u => u.username === username)) return res.status(400).json({ msg: "User already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, password: hashedPassword });
    res.json({ success: true, msg: "Registration successful!" });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ msg: "Invalid credentials" });
    }
    req.session.user = username;
    res.json({ success: true, username });
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/products', (req, res) => res.json(products));

app.post('/api/order', (req, res) => {
    if (!req.session.user) return res.status(401).json({ msg: "Please log in first" });
    const { cart, total } = req.body;
    const order = { id: orders.length + 1, user: req.session.user, items: cart, total, date: new Date() };
    orders.push(order);
    res.json({ success: true, orderId: order.id });
});

app.get('/api/user', (req, res) => res.json({ user: req.session.user || null }));

// Frontend Single Page Serving
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>CodeAlpha E-Commerce Store</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; background: #f4f4f4; }
            header { background: #333; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; }
            .container { max-width: 1000px; margin: 20px auto; padding: 20px; background: white; border-radius: 8px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; background: #fff; }
            .card img { max-width: 100%; height: 150px; object-fit: cover; }
            button { background: #28a745; color: white; border: none; padding: 10px 15px; cursor: pointer; border-radius: 4px; }
            button:hover { background: #218838; }
            .auth-box { max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ddd; background: white; border-radius: 8px; }
            input { width: 90%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
            .cart-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd; }
        </style>
    </head>
    <body>
        <header>
            <h1>AlphaStore</h1>
            <div id="nav-auth"></div>
        </header>
        <div class="container" id="main-content"></div>

        <script>
            let cart = [];
            let currentView = 'products';

            async function checkAuth() {
                const res = await fetch('/api/user');
                const data = await res.json();
                const authDiv = document.getElementById('nav-auth');
                if (data.user) {
                    authDiv.innerHTML = \`<span>Welcome, \${data.user}</span> | <a href="#" onclick="logout()" style="color:white;">Logout</a> | <a href="#" onclick="renderCart()" style="color:white;">Cart (\${cart.length})</a>\`;
                } else {
                    authDiv.innerHTML = \`<a href="#" onclick="renderAuth('login')" style="color:white;">Login</a> | <a href="#" onclick="renderAuth('register')" style="color:white;">Register</a>\`;
                }
                return data.user;
            }

            async function loadProducts() {
                const res = await fetch('/api/products');
                const products = await res.json();
                let html = '<h2>Our Products</h2><div class="grid">';
                products.forEach(p => {
                    html += \`
                        <div class="card">
                            <img src="\${p.img}" alt="\${p.name}">
                            <h3>\${p.name}</h3>
                            <p>\${p.desc}</p>
                            <p><strong>$\${p.price}</strong></p>
                            <button onclick="addToCart(\${p.id}, '\${p.name}', \${p.price})">Add to Cart</button>
                        </div>\`;
                });
                html += '</div>';
                document.getElementById('main-content').innerHTML = html;
            }

            function addToCart(id, name, price) {
                cart.push({ id, name, price });
                checkAuth();
                alert(\`\${name} added to cart!\`);
            }

            function renderCart() {
                let total = cart.reduce((sum, item) => sum + item.price, 0);
                let html = '<h2>Your Shopping Cart</h2>';
                if(cart.length === 0) {
                    html += '<p>Cart is empty</p><button onclick="loadProducts()">Back to Store</button>';
                } else {
                    cart.forEach((item, index) => {
                        html += \`<div class="cart-item"><span>\${item.name}</span><span>$\${item.price}</span></div>\`;
                    });
                    html += \`<h3>Total: $\${total}</h3>\`;
                    html += \`<button onclick="checkout(\${total})">Checkout Order</button> <button onclick="loadProducts()">Continue Shopping</button>\`;
                }
                document.getElementById('main-content').innerHTML = html;
            }

            async function checkout(total) {
                const user = await checkAuth();
                if(!user) { alert('Please log in first!'); renderAuth('login'); return; }
                const res = await fetch('/api/order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cart, total })
                });
                const data = await res.json();
                if(data.success) {
                    alert('Order Placed Successfully! Order ID: ' + data.orderId);
                    cart = [];
                    checkAuth();
                    loadProducts();
                }
            }

            function renderAuth(type) {
                document.getElementById('main-content').innerHTML = \`
                    <div class="auth-box">
                        <h2>\${type === 'login' ? 'Login' : 'Register'}</h2>
                        <input type="text" id="username" placeholder="Username">
                        <input type="password" id="password" placeholder="Password">
                        <button onclick="handleAuth('\${type}')">\${type === 'login' ? 'Login' : 'Register'}</button>
                    </div>\`;
            }

            async function handleAuth(type) {
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const res = await fetch(\`/api/\${type}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if(data.success) {
                    alert(data.msg || "Logged in successfully!");
                    checkAuth();
                    loadProducts();
                } else {
                    alert(data.msg);
                }
            }

            async function logout() {
                await fetch('/api/logout');
                cart = [];
                checkAuth();
                loadProducts();
            }

            checkAuth();
            loadProducts();
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => console.log(`E-commerce Store operational at http://localhost:${PORT}`));