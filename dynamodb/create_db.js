const aws = require("aws-sdk");
aws.config.update({
  region: "local",
  endpoint: "http://localhost:8000"
});

const tables = ["clients", "tokens"];
const dynamodb = new aws.DynamoDB();

tables.forEach(e => {
  var params = {
      TableName : e,
      KeySchema: [
          { AttributeName: "id", KeyType: "HASH"},  //Partition key
      ],
          AttributeDefinitions: [
              { AttributeName: "id", AttributeType: "S" },
      ],
      ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
      }
  };

  dynamodb.createTable(params, function(err, data) {
      if (err) {
          console.error("Unable to create table " + e + ". Error JSON:", JSON.stringify(err, null, 2));
      } else {
          console.log("Created table " + e + ". Table description JSON:", JSON.stringify(data, null, 2));
      }
  });
});
