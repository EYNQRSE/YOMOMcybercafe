const express = require('express');
const app = express();
const port = process.env.PORT || 3002;
app.use(express.json());
const jwt = require('jsonwebtoken');

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://B022120016:hUF1LQVnNZ5d2QpI@group12.7c7yswx.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

client.connect().then(res => {
  console.log(res);
});

app.get('/',(req,res) => {
    res.send('welcome to YOMOM');
});

function verifyToken(req, res, next) {
    let header = req.headers.authorization;
    if (!header) {
        res.status(401).send('Unauthorized');
        return;
    }

    let token = header.split(' ')[1];

    jwt.verify(token, 'password', function (err, decoded) {
        if (err) {
            res.status(401).send('Unauthorized');
            return;
        }
        req.user = decoded;
        next();
    });
}

function verifyAdminToken(req, res, next) {
    verifyToken(req, res, function () {
        if (req.user && req.user.role === 'admin') {
            next();
        } else {
            res.status(403).send('Forbidden: Admin access required');
        }
    });
}

app.post('/login/admin', (req, res) => {
    login(req.body.username, req.body.password)
        .then(result => {
            if (result.message === 'Access Granted') {
                const token = generateToken({ username: req.body.username, role: 'admin' });
                res.send({ message: 'Successful login', token });
            } else {
                res.send('Login unsuccessful');
            }
        })
        .catch(error => {
            console.error(error);
            res.status(500).send("Internal Server Error");
        });
});

async function login(reqUsername, reqPassword) {
    let matchUser = await client.db('cybercafe').collection('admin').findOne({ username: { $eq: reqUsername } });

    if (!matchUser)
        return { message: "User not found!" };

    if (matchUser.password === reqPassword)
        return { message: "Access Granted", user: matchUser };
    else
        return { message: "Invalid password" };
}

app.put('/update/computer/:computername', verifyToken, async (req, res) => {
    const computername = req.params.computername;
    const { systemworking, available } = req.body;

    try {
        console.log(req.user)
        const updatecomputerResult = await client
            .db('configure')
            .collection('computer')
            .updateOne({ computername },
                { $set: { systemworking, available } });

        if (updatecomputerResult.modifiedCount === 0) {
            return res.status(404).send('computer not found or unauthorized');
        }

        res.send('computer updated successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

async function getAvailableCabins() {
    try {
        const result = await client
            .db('configure')
            .collection('computer')
            .find({ systemworking: 'yes' }, { _id: 0, cabinno: 1, computername: 1, available: 1 })
            .toArray();

        return result.map(computer => ({
            cabinno: computer.cabinno,
            computername: computer.computername,
            availability: computer.available,
        }));
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}

app.get('/available/cabins', async (req, res) => {
    try {
        const availableCabins = await getAvailableCabins();
        res.send(availableCabins);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/create/member', verifyToken, async (req, res) => {
    console.log(req.user);

    let result = createMember(
        req.body.customername,
        req.body.idproof,
        req.body.password
    );
    res.send(result);
});

function createMember(reqcustomername, reqidproof, reqpassword) {
    client.db('cybercafe').collection('customer').insertOne({
        "customername": reqcustomername,
        "idproof": reqidproof,
        "password": reqpassword,
        "role": "member"
    });
    return "Customer account has been created. Welcome YOMOM member!!:D";
}

app.post('/login/member', async (req, res) => {
    try {
        const result = await memberLogin(req.body.idproof, req.body.password);
        if (result.message === 'Correct password') {
            const token = generateToken({ idproof: req.body.idproof, role: 'member' });
            res.send({ message: 'Successful login. Welcome to YOMOM CYBERCAFE', token });
        } else {
            res.send('Login unsuccessful');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

async function memberLogin(idproof, password) {
    let matchUser = await client.db('cybercafe').collection('customer').findOne({ idproof: { $eq: idproof } });

    if (!matchUser) {
        return { message: 'User not found!' };
    }

    if (matchUser.password === password) {
        return { message: 'Correct password', user: matchUser };
    } else {
        return { message: 'Invalid password' };
    }
}

app.get('/get/members', verifyAdminToken, async (req, res) => {
    try {
        const allMembers = await getAllMembers();
        res.send(allMembers);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

async function getAllMembers() {
    try {
        const result = await client
            .db('cybercafe')
            .collection('customer')
            .find({ role: 'member' }, { _id: 0, customername: 1, })
            .toArray();

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

app.post('/create/visitor', verifyToken, async (req, res) => {
    try {
        const memberName = req.user.customername;
        console.log(req.user);

        let result = await createVisitor(
            memberName,
            req.body.visitorname,
            req.body.idproof
        );

        res.send(result);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

async function createVisitor(memberName, visitorName, idProof, entryTime = 0, cabinNo = 0, payment = 0, timeSpend = 0) {
    try {
        const result = await client.db('cybercafe').collection('visitor').insertOne({
            "createdBy": memberName,
            "visitorname": visitorName,
            "idproof": idProof,
            "cabinno": cabinNo,
            "entrytime": entryTime,
            "payment": payment,
            "timespend": timeSpend,
        });

        return "Visitor account has been created. Welcome to YOMOM Cybercafe! :D";
    } catch (error) {
        console.error(error);
        return "Failed to create visitor account. Please try again later.";
    }
}

app.get('/get/my-visitors', verifyToken, async (req, res) => {
    try {
        const memberName = req.user.customername;

        if (req.user.role === 'admin') {
            const allVisitors = await getAllVisitors();
            res.send(allVisitors);
        } else {
            const visitors = await getVisitorsCreatedByMember(memberName);
            res.send(visitors);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

async function getAllVisitors() {
    try {
        const result = await client
            .db('cybercafe')
            .collection('visitor')
            .find({}, { _id: 0, visitorname: 1 })
            .toArray();

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function getCustomerOnline() {
    try {
        const result = await client
            .db('cybercafe')
            .collection('customer')
            .find({ online: 'yes' }, { _id: 0, customername: 1, idproof: 1, cabinno: 1 })
            .toArray();

        return result.map(customer => ({
            customername: customer.customername,
            idproof: customer.idproof,
            cabinno: customer.cabinno,
        }));
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}

app.get('/online/customer/admin', verifyToken, async (req, res) => {
    try {
        const onlineCustomer = await getCustomerOnline();
        res.send(onlineCustomer);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/view/computer/admin', verifyToken, async (req, res) => {
    try {
        const result = await client
            .db('configure').collection().toArray();

        res.send(result);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

function generateToken(userData) {
    const token = jwt.sign(
        userData,
        'password',
        { expiresIn: 600 }
    );

    console.log(token);
    return token;
}

app.patch('/update/value/:id', async (req, res) => {
    const search = req.params.id;
    const value = req.body.value;
    await client.db().collection().updateOne({ id: search }, { $set: value });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
