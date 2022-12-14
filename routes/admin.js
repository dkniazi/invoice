const express = require('express');
const app = express();
const Joi = require('joi');
const bcrypt = require('bcrypt');
const { User, validateUser } = require('../models/admins');
const { Client } = require('../models/clients');
const nodemailer = require('nodemailer');
const auth = require('../middleware/auth');
const { Invoice } = require('../models/invoices')
require('dotenv').config();

app.get('/seeClients', auth, async(req, res) => {
    const client = await Client
                            .find()
                            .populate('invoice');
    res.send(client)
});

app.get('/seeClient/:id', auth, async(req, res) => {
    const client = await Client
                            .findById(req.params.id)
                            .populate('invoice');
    res.send(client)
});

app.post('/signup', async (req, res) => {
    const { error } = validateUser(req.body);
    if(error) return res.status(400).send(error.details[0].message);

    let { name, email, password, phoneNumber, isAdmin } = req.body;

    let user = await User.findOne({ email });
    if(user) return res.status(400).send('User already register!');

    
    user = await new User({
        name,
        email,
        password,
        phoneNumber,
        isAdmin,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    user = await user.save();

    const token = user.generateAuthToken()
    // console.log(token);
    res.header('token', token).send(user).status(200);
});

app.post('/login', async (req, res) => {
    const { error } = validate(req.body);
    if(error) return this.response.status(400).send(error.details[0].message);

    let { email, password } = req.body;

    let user = await User.findOne({ email });
    if(!user) return res.status(400).send('Invalid Credentails!');

    const validPassword = await bcrypt.compare(password, user.password);
    if(!validPassword) return res.status(400).send('Invalid Credentails!');

    const token = user.generateAuthToken();
    res.header('token', token).status(200).json({
        LogInSuccessful: {
            "See All Clients": "GET http://localhost:3000/admin/seeClients",
            "See a specific Client": "GET http://localhost:3000/admin/seeClient/:id",
            "Create an Invoice": "PUT http://localhost:3000/admin/client/createInvoice",
            "Send an Invoice Via Email": "POST http://localhost:3000/admin/sendInvoice",
            "Update your Account": "PUT http://localhost:3000/admin/:id",
            "Delete Your Acount": "DELETE http://localhost:3000/admin/:id"
        },
        user
    });
});

app.put('/:id', auth, async (req, res) => {
    const { error } = validateUser(req.body);
    if(error) return res.status(400).send(error.details[0].message);

    let { name, email, password, phoneNumber, isAdmin } = req.body;

    let user = await User.findOne({ email });
    if(user) return res.status(400).send('User already register!');

    
    user = await User.findByIdAndUpdate(req.params.id,
    {
        name,
        email,
        password,
        phoneNumber,
        isAdmin,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    user = await user.save();

    const token = user.generateAuthToken()
    console.log(token);
    res.header('token', token).send(user).status(200);
});


app.put('/client/createInvoice', auth, async(req, res) => {
    let { email } = req.body;

    let dt = new Date;
    let date = dt.getDate();
    let month = dt.getMonth();
    let year =  dt.getFullYear();

    let client = await Client.findOne({ email }).populate('invoice');
    for(let key in client)
    {
        key = client.invoice.paid
        if(key == false)
        {
            res.send('Client hasn\'t paid his dues.')
        }
        else{

            if(date >= 5)
            {
                month++;
                due_date = 5 + '-' + month + '-' + year;

                totalAmount = Math.floor(Math.random() * 50000);
                let percentage = totalAmount * 0.2;
                totalAmountDue = totalAmount + percentage;
                let link = 'http://localhost:3000/client/payBills'
                let paid = false;

                let invoice = await new Invoice({
                    due_date,
                    totalAmount,
                    totalAmountDue,
                    link,
                    paid
                });

                invoice = await invoice.save();
            
                let client = await Client.findOneAndUpdate({email},
                    {
                        invoice
                    }, { new: true }).populate('invoice');
                res.send(client);
            }
        }
    }
    res.send('No Dues left to pay!')
});

app.post('/sendInvoice', auth, async(req, res) => {
    const { email } = req.body
    
    let client = await Client
                        .findOne({ email })
                        .populate('invoice');

    let dt = new Date;
    let date = dt.getDate();
    let month = dt.getMonth();

    clientDate = Number(client.invoice.due_date.slice(0,1));
    clientMonth = Number(client.invoice.due_date.slice(2,4));   //2-10-2022

    if(month > clientMonth)
    {
        if(date > clientDate)
        {
            var transporter = nodemailer.createTransport({
                service: "hotmail",
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.PASSWORD
                }
            });

            var mailOptions = {
                from: 'dilawar.niazi.dn@hotmail.com',
                to: client.email,
                subject: 'Due date Is Over',
                text: `Please pay your dues, fine will be charged further more! ${client.invoice.link}`
            };
            
            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                res.send(error);
                } else {
                res.send('Email sent: ' + info.response);
                }
            });
        }
    };
    res.send('No dues left!').status(200);
});

app.delete('/:id', async(req, res) => {
    const user = await User.findByIdAndRemove(req.params.id);

    if (!user) return res.status(404).send('The user with the given ID was not found.');

    res.send('Deleted');
})


function validate(req) {
    const schema = {
        email: Joi.string().required().email(),
        password: Joi.string().required()
    };
    
  return Joi.validate(req, schema);
}

module.exports = app;