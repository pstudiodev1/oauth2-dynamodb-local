const aws = require("aws-sdk");
const jwt = require('jsonwebtoken');
const httpStatusCodes = require('http-status-codes');
const moment = require('moment');

aws.config.update({
  region: "local",
  endpoint: "http://localhost:8000"
});

// Load .env file
require('dotenv').config();

//
exports.authorize = async function (req, res, next) {
  const responseType = req.query.response_type;
  const clientID = req.query.client_id;
  const redirectURI = req.query.redirect_uri;
  if(responseType === 'code') {
    const docClient = new aws.DynamoDB.DocumentClient()
    var params = {
        TableName: "clients",
        Key:{
            "id": clientID
        }
    };

    docClient.get(params, function(err, data) {
      if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(httpStatusCodes.INTERNAL_SERVER_ERROR);
        return;
      } 

      // Gen token
      const authorizationCode = jwt.sign({}, 
        process.env.JWT_SECRET_AUTHORIZATION_CODE, 
        { 
          algorithm: 'HS256',  
          expiresIn: process.env.AUTHORIZATION_CODE_EXPIRE_IN + "s"
        }
      );

      // Store to dynamodb
      const batchParams = {
        RequestItems: {
          "tokens": [
              {
                PutRequest: {
                Item: {
                  id: authorizationCode,
                  type: "authorization_code",
                  ref: "",
                  expires_in: moment().add(process.env.AUTHORIZATION_CODE_EXPIRE_IN, 'seconds').unix()
                }
                }
              },
          ]
        }
      };

      docClient.batchWrite(batchParams, function(err, data) {
        if(err) {
          console.error("Unable to store item. Error JSON:", JSON.stringify(err, null, 2));
          res.status(httpStatusCodes.INTERNAL_SERVER_ERROR);
          return;
        } 

        // Return response
        const uri = redirectURI + "?code=" + authorizationCode;
        console.log(uri);
        res.writeHead(httpStatusCodes.MOVED_PERMANENTLY, {
          Location: uri
        });
        res.end();
      });
    });
  }
}

//
exports.token = async function (req, res, next) {
  const grantType = req.body.grant_type;
  if(grantType === 'authorization_code') {
    authorization_code(req, res);
  } else if(grantType === 'client_credentials') {
    token_client_credential(req, res);
  } else if(grantType === 'pkce') {

  }
}

//
exports.profile = async function (req, res, next) {
  const token = req.headers.authorization.split(' ')[1];
  if(!token) {
    res.status(httpStatusCodes.BAD_REQUEST).send();
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET_ACCESS_TOKEN, { algorithm: "HS256" }, (err, data) => {
    res.status(httpStatusCodes.OK).send(data);
    return;
  });
}

//
exports.verify = async function (req, res, next) {
  const token = req.headers.authorization.split(' ')[1];
  if(!token) {
    res.status(httpStatusCodes.BAD_REQUEST).send();
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET_ACCESS_TOKEN, { algorithm: "HS256" }, (err, data) => {
    res.status(httpStatusCodes.OK).send();
    return;
  });
}

//
function authorization_code(req, res) {
  const code = req.body.code;
  const clientID = req.body.client_id;
  const clientSecret = req.body.client_secret;

  const docClient = new aws.DynamoDB.DocumentClient()
  var params = {
      TableName: "tokens",
      Key:{
          "id": code
      }
  };

  docClient.get(params, function(err, data) {
      if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(httpStatusCodes.BAD_REQUEST).send();
        return;
      } 

      var params = {
          TableName: "clients",
          Key:{
              "id": clientID
          }
      };

      docClient.get(params, async function(err, data) {
        if (err) {
          console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
          res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send();
          return;
        }

        // Check secret
        if(clientSecret != data.Item.secret) {
          res.status(httpStatusCodes.UNAUTHORIZED).send();
          return;
        }

        // Gen token
        const token = await getToken(docClient, data);
        if(token === null) {
          res.status(httpStatusCodes.INTERNAL_SERVER_ERROR);
        }

        res.status(httpStatusCodes.OK).send(token);
      });
  });
}

//
function token_client_credential(req, res) {
  const clientID = req.body.client_id;
  const clientSecret = req.body.client_secret;

  const docClient = new aws.DynamoDB.DocumentClient()
  var params = {
      TableName: "clients",
      Key:{
          "id": clientID
      }
  };

  docClient.get(params, async function(err, data) {
      if (err) {
        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        res.status(httpStatusCodes.BAD_REQUEST).send();
        return;
      } 

      // Check secret
      if(clientSecret != data.Item.secret) {
        res.status(httpStatusCodes.UNAUTHORIZED).send();
        return;
      }

      const token = await getToken(docClient, data);
      if(token === null) {
        res.status(httpStatusCodes.INTERNAL_SERVER_ERROR);
      }

      res.status(httpStatusCodes.OK).send(token);
  });
}

async function getToken(docClient, data) {
  return await new Promise((resolve, reject) => {
    // Gen token
    const accessToken = jwt.sign({ 
        name: data.Item.name
      }, 
      process.env.JWT_SECRET_ACCESS_TOKEN, 
      { 
        algorithm: 'HS256',  
        expiresIn: process.env.ACCESS_TOKEN_EXPIRE_IN + "s"
      }
    );

    const refreshToken = jwt.sign({}, 
      process.env.JWT_SECRET_REFRESH_TOKEN, 
      { 
        algorithm: 'HS256',  
        expiresIn: process.env.REFRESH_TOKEN_EXPIRE_IN + "s"
      }
    );

    // Store to dynamodb
    const batchParams = {
      RequestItems: {
        "tokens": [
            {
              PutRequest: {
                Item: {
                  id: accessToken,
                  type: "access_token",
                  ref: refreshToken,
                  expires_in: moment().add(process.env.ACCESS_TOKEN_EXPIRE_IN, 'seconds').unix()
                }
              }
            },
            {
              PutRequest: {
                Item: {
                  id: refreshToken,
                  type: "refresh_token",
                  ref: accessToken,
                  expires_in: moment().add(process.env.REFRESH_TOKEN_EXPIRE_IN, 'seconds').unix()
                }
              }
            }
        ]
      }
    };

    docClient.batchWrite(batchParams, function(err, data) {
      if(err) {
        console.error("Unable to store item. Error JSON:", JSON.stringify(err, null, 2));
        resolve(null);
      } 

      const token = { 
        access_token: accessToken,
        refresh_token: refreshToken,
        type: "Bearer",
        expires_in: process.env.ACCESS_TOKEN_EXPIRE_IN
      };

      // Return response
      resolve(token);
    });
  });
}
