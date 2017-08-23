var express = require("express");
var myParser = require("body-parser");
var promise = require("bluebird");
var request = require("request");
var zipcodes = require("zipcodes");
const nearbyCities = require("nearby-big-cities");

var options = {
  promiseLib: promise // overriding the default (ES6 Promise);
};
var app = express();
var pg = require("pg");
var pgp = require("pg-promise")(options);

var connectionString = "postgres://satish:mataji786@localhost:5432/powerlife";
var db = pgp("postgres://satish:mataji786@localhost:5432/powerlife");
app.use(express.static("."));
app.use(myParser.json());
app.use(myParser.urlencoded({ extended: true }));

//const cors = require('cors')
//app.use(cors())

const groupBy = (name, array) => {
  const grouped = array.reduce((acc, item) => {
    const propValue = item[name];
    if (!acc[propValue]) {
      acc[propValue] = item;
    }
    return acc;
  }, {});

  return Object.keys(grouped).map(key => {
    return grouped[key];
  });
};

app.all("/*", function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,accept,access_token,X-Requested-With"
  );
  next();
});
/*app.use(express.static('.'))

app.listen(3000, function () {
  console.log('App listening on port 3000!')
})*/

app.get("/", function(req, res, next) {
  pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log("not able to get connection " + err);
      res.status(400).send(err);
    }
    client.query("SELECT * FROM student", function(err, result) {
      done(); // closing the connection;
      if (err) {
        console.log(err);
        res.status(400).send(err);
      }
      res.status(200).send(result.rows);
    });
  });
});

app.get("/customer", function(req, res, next) {
  pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log("not able to get connection " + err);
      res.status(400).send(err);
    }
    client.query(
      "SELECT e.id,e.email,e.first_name, e.last_name, ga.address1,ga.city,ga.state,ga.zipcode FROM ENTITYNAME e" +
        " JOIN Entity_xref ex on e.id = ex.entity_id" +
        " JOIN geographic_address ga on ex.address_id = ga.id",
      function(err, result) {
        done(); // closing the connection;
        if (err) {
          console.log(err);
          res.status(400).send(err);
        }
        res.status(200).send(result.rows);
      }
    );
  });
});

app.post("/register", function(req, res, next) {
  console.log("Params: ", req.body.firstName);

  //console.log("TEST",test.firstName);
  pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log("not able to get connection " + err);
      res.status(400).send(err);
    }
    var createDate = new Date();
    /*client.query('INSERT INTO ENTITYNAME(first_name,last_name, date_created, date_modified, user_created, user_modified) values($1,$2,$3,$4,$5,$6)',[req.body.firstName,req.body.lastName, createDate,createDate,1,1] , function(err,result) {
           done(); // closing the connection;
           if(err){
               console.log(err);
               res.status(400).send(err);
           }
           res.status(200).send(result);
       });*/
    db
      .tx(t1 => {
        return t1.batch([
          t1.one(
            "INSERT INTO ENTITYNAME(first_name,last_name, email, date_created, date_modified, user_created, user_modified) values($1,$2,$3,$4,$5,$6,$7) returning *",
            [
              req.body.firstName,
              req.body.lastName,
              req.body.email,
              createDate,
              createDate,
              1,
              1
            ]
          ),
          t1.one(
            "INSERT INTO GEOGRAPHIC_ADDRESS(address1, address2, city, state, country, zipcode) values($1,$2,$3,$4,$5,$6) returning id",
            [
              req.body.address,
              "",
              req.body.city,
              req.body.state,
              "USA",
              req.body.zip
            ]
          )
        ]);
      })
      .then(data => {
        console.log("Data:", data[0].id, data[1].id);
        db.tx(t2 => {
          return t2.batch([
            t2.none(
              "INSERT INTO ENTITY_XREF(entity_id,entity_type_id,address_id,energy_id) values($1,$2,$3,$4)",
              [data[0].id, 1, data[1].id, null]
            )
          ]);
        });
        console.log("ROWS", data[0].first_name);
        res.json(data[0]);
      })
      /*.spread((entity, entityType) => {
        // print new Entity id  and Entity Type  id;
        console.log('DATA:', entity.id, entityType.entity_type_id);
        res.json(entity)
    })*/
      .catch(error => {
        console.log("ERROR:", error); // print the error;
      })
      .finally(() => {
        // If we do not close the connection pool when exiting the application,
        // it may take 30 seconds (poolIdleTimeout) before the process terminates,
        // waiting for the connection to expire in the pool.

        // But if you normally just kill the process, then it doesn't matter.

        pgp.end(); // for immediate app exit, closing the connection pool.

        // See also:
        // https://github.com/vitaly-t/pg-promise#library-de-initialization
      });
  });
});

app.get("/checkUser/:EMAIL", function(req, res, next) {
  console.log("EMAIL:", req.params.EMAIL);
  pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log("not able to get connection " + err);
      res.status(400).send(err);
    }
    console.log("EMAIL:", req.params);
    client.query(
      "SELECT e.id,e.first_name, e.last_name, ga.address1,ga.city,ga.state,ga.zipcode FROM ENTITYNAME e" +
        " JOIN Entity_xref ex on e.id = ex.entity_id" +
        " JOIN geographic_address ga on ex.address_id = ga.id" +
        " WHERE e.email = $1",
      [req.params.EMAIL],
      function(err, result) {
        done(); // closing the connection;
        if (err) {
          console.log(err);
          res.status(400).send(err);
        }
        res.status(200).send(result.rows);
      }
    );
  });
});

app.get("/getSolarInstalls", function(req, res, next) {
  /*  const lat = req.query.lat
  const lng = req.query.lng*/
  const cityName = req.query.cityName;
  //console.log("EMAIL:", req.params.zipcode);
  //const zipcode = req.params.zipcode;
  let zipcodeResult = zipcodes.lookupByName(cityName, "CA");
  if (Array.isArray(zipcodeResult)) {
    zipcodeResult = zipcodeResult[0];
  }
  const zipcode = zipcodeResult.zip;
  console.log("looking for", cityName, "result", zipcode);
  const zipCodesInRadius = zipcodes.radius(zipcode, 15);
  //  return;
  //  console.log("ZipCodes:", zipCodesInRadius);
  pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log("not able to get connection " + err);
      res.status(400).send(err);
    }
    console.log("EMAIL:", req.params);
    //  zipCodesInRadius.length = 3;
    const query =
      `select   city, count(*) as solarinstalls , sum(CAST(coalesce(size_kw, '0') AS float)) as total_kw, AVG(CAST(coalesce(cost_per_watt,'0') AS float)) as costPerWatt
    from installations where zipcode in (` +
      zipCodesInRadius.map(zip => "'" + zip + "'").join(", ") +
      ") GROUP By  city  order by city asc";

    console.log("query", query);
    client.query(query, function(err, result) {
      done(); // closing the connection;
      if (err) {
        console.log(err);
        res.status(400).send(err);
      }
      //  console.log(result.rows);
      //  const rows = groupBy("city", result.rows);
      //const arrTest = ["One", "Three", "One", "Two", "Four", "One", "Five"];
      console.log("RESULTS", result.rows);
      const newObject = [];
      for (var i = 0; i < result.rows.length - 1; i++) {
        var currentRow = result.rows[i];
        console.log("lloing for", currentRow);
        var zipcodeForCity = zipcodes.lookupByName(currentRow.city, "CA");
        if (zipcodeForCity.length) {
          console.log(zipcodeForCity, "!");
          currentRow["zipcode"] = zipcodeForCity[0].zip;
          currentRow.lat = zipcodeForCity[0].latitude;
          currentRow.lng = zipcodeForCity[0].longitude;
          newObject.push(currentRow);
        }
      }
      //console.log("New Object", JSON.stringify(newObject));
      res.status(200).json(newObject);
    });
  });
});
app.get("/topInstallers/:cityName", function(req, res, next) {
  const cityName = req.params.cityName;
  console.log("CityName:", cityName);
  pg.connect(connectionString, function(err, client, done) {
    if (err) {
      console.log("not able to get connection " + err);
      res.status(400).send(err);
    }
    client.query(
      "select installer as companyName, count(*) as installs from installations where city=$1 GROUP By installer order by installs desc limit 10",
      [cityName],
      function(err, result) {
        done(); // closing the connection;
        if (err) {
          console.log(err);
          res.status(400).send(err);
        }
        const rows = result.rows.map(row => {
          return {
            companyName: row.companyname || "Other",
            installs: row.installs * 1
          };
        });
        res.status(200).send(rows);
      }
    );
  });
});

app.listen(4000, function() {
  console.log("Server is running.. on Port 4000");
});
