'use strict';

const express = require('express');
const session = require('express-session');
const  xero_node = require('xero-node')
const CronJob = require('node-cron');
const client_id = 'your-client-id'
const client_secret = 'your-client-secret'
const redirectUri = 'http://localhost:5000/callback'
const scopes = 'openid profile email accounting.transactions accounting.settings offline_access'

const xero = new xero_node.XeroClient({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUris: [redirectUri],
  scopes: scopes.split(" "),
  state:123,
});

let app = express()

app.set('port', (process.env.PORT || 3000))
app.use(express.static(__dirname + '/public'))
app.use(session({
    secret: 'something crazy',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.get('/', function(req, res) {
    console.log("test")
  res.send('<a href="/connect">Connect to Xero</a>');
})

app.get('/connect', async function(req, res) {
  try {
    // console.log("connect")
    let consentUrl = await xero.buildConsentUrl();
    // console.log(consentUrl)	  
    res.redirect(consentUrl);
  } catch (err) {
    res.send("Sorry, something went wrong");
  }
})

app.get('/callback', async function(req, res) {
    try{
        // let url = "http://localhost:5000/" + req.originalUrl;
        const xerocallbak= await xero.apiCallback(req.originalUrl);
        const tenantid= await xero.updateTenants()
        // Optional: read user info from the id token
        let tokenClaims = await xero.readIdTokenClaims();
        const accessToken = await xero.readTokenSet();
        req.session.tokenSet = xerocallbak
        req.session.tokenClaims = tokenClaims;
        req.session.accessToken = accessToken;
        // req.session.allTenants = xero.tenants
        req.session.xeroTenantId = tenantid[1].tenantId
        res.redirect('/organisation');
    }catch(err){
        // console.log(err)
        res.send("Sorry, something went wrong");

    }
    
})

app.get('/organisation', async function(req, res) {  
  try {
    const response = await xero.accountingApi.getOrganisations(req.session.xeroTenantId)
    res.send("Hello, " + response.body.organisations[0].name);
  } catch (err) {
    // console.log(err)
    res.send("Sorry, something went wrong");
  }
})

app.get('/items',async function(req,res){
    try{
      // console.log(xero.tenants)
     const items= await xero.accountingApi.getItems(xero.tenants[1].tenantId)
     res.json(items.body.items)
    }catch(err){
        // console.log(err)
        res.send("Sorry, something went wrong");
    }
})

app.post('/items-add',async function(req,res){
  try {
    const invoices = {
			invoices: [
				{
					type: "ACCPAY",
					contact: {name: "Inventory Adjustments"},
					lineItems: [
            {
              itemCode: "3",
              description: "sawi senin",
              quantity: "2.0000",
              // unitAmount: "1000.00",
              accountCode: "630"
            }
            // {
            //   description: "Inventory test",
            //   quantity: "2.0000",
            //   unitAmount: "1000.00",
            //   accountCode: "310"
            // },
					],
					date: "2020-09-17",
					dueDate: "2020-09-17",
					reference: "Kamis beli",
          status: "AUTHORISED",
          subTotal:"2.0000"
				}
			]
		};

   const Adjustment=  await xero.accountingApi.createInvoices(xero.tenants[1].tenantId,invoices)
   res.json(Adjustment)
  } catch (error) {
    console.log(error)
    res.send("Sorry, something went wrong");
    
  }
})

app.post('/items-decrease', async function(req,res){
  try {
    const invoices = {
			creditNotes: [
				{
					type: "ACCPAYCREDIT",
					contact: {name: "Inventory Decrease"},
					lineItems: [
            {
              itemCode: "3",
              description: "sawi senin",
              quantity: "1.0000",
              // unitAmount: "1000.00",
              accountCode: "630"
            },
            // {
            //   description: "Inventory Decrease",
            //   quantity: "1.0000",
            //   unitAmount: "-1000.00",
            //   accountCode: "200"
            // },
					],
					date: "2020-09-17",
					dueDate: "2020-09-17",
					reference: "Kamis jual",
          status: "AUTHORISED",
          // subTotal:""
				}
			]
		};

   const decrease=  await xero.accountingApi.createCreditNotes(xero.tenants[1].tenantId,invoices)
   res.json(decrease)
  } catch (error) {
    // console.log(error)
    res.json(error)
  }
})

app.post('/create-items',async function(req,res){
  try {
    const items = {
      items:[{
        itemId: "4",
        code: "4",
        name:"sawi bae",
        description: "bingung sayuran",
        purchaseDetails: {
          unitPrice: "149.0000",
          accountCode: "310"
        },
        salesDetails: {
          unitPrice: 299.0000,
          accountCode: "200"
        },
        isTrackedAsInventory: true
      }]
    }
   await xero.accountingApi.createItems(xero.tenants[1].tenantId,items)
  } catch (error) {
    console.log(error)
  }
})

// refresh token every 5 minutes 
const refreshToken =  CronJob.schedule('*/5 * * * *',async function() {
  console.log(xero.tenants[1].tenantId)
  await xero.refreshToken(xero.tenants[1].tenantId)
  console.log("cronjob")
  console.log(xero.tenants[1].tenantId)
});
refreshToken.start()

const PORT = process.env.PORT || 5000;
app.listen(PORT, function() {
  console.log("Your Xero basic public app is running at localhost:" + PORT)
})