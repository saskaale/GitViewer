#!/usr/bin/nodejs
var http = require('http');
var https = require('https');
var fs = require('fs');

var PORT = 8080;
var DEBUG = 5;

var mimes = {};

function loadStaticFiles(){
    var r = {};

    var files = fs.readdirSync('./staticweb');
    for(var i in files) {
      r['/'+files[i]] = fs.readFileSync('./staticweb/'+files[i]);
    }

    return r;
}

function load_mime_types(){
    var r = {};
    var conf = fs.readFileSync('mimetypes.list').toString();

    conf.split(/\n/g).forEach(function(l){
    	var cols = l.split(/\s+/g);
    	if(cols.length < 2)
  	    return;

      let suffix = cols[0].substring(1);
    	r[suffix] = cols[1];
    });
    return r;
}


var staticfiles = loadStaticFiles();

mimes = load_mime_types();

console.log("Loaded MIME types");
console.log("start running on localhost:"+PORT);

function processQuery(q, req, res){
//    q = q.replace(/^q=/g,"");
    q = decodeURIComponent(q);

    q = q.replace(/^\?q\=(((http(s?):\/\/)?(([^\.\/]+)\.)+([^\.\/]+)\/)?)/g, "");


    if(!/^\//g.test(q))
	     q = '/'+q;

    q = q.replace(/^\/([^\/]+)\/([^\/]+)\/blob/g, function(all, p1, p2){return "/"+p1+"/"+p2;});

    if(DEBUG)
	    console.log("query "+q);

    var redirect = q;

    console.log('redirecting to '+redirect);

//    res.writeHead(200, {});
    res.writeHead(302, {'Location': redirect});
    res.end("");
    return false;
}

http.createServer(function (req, res) {

  var url = req.url.toString();
  if(url == '' || url == '/')
    url = '/index.html';

  if(DEBUG)
    console.log('GET '+url);

  var s = undefined;
  url.replace(/\/goto?(.+)$/g, function(all, get){s=get;});

  if(s){
    if(processQuery(s, req, res))
	     return;
  }

  var suffix = "";
  url.replace(/\.([^\.]+)$/g, function(all, s){
    suffix = s;
  });
  var mime = mimes[suffix||'txt'];

  if(mime === ""){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("Unknown type of file");
    return;
  }

  //serve static
  if(staticfiles[url]){
    res.writeHead(200, {'Content-Type': mime});
    res.end(staticfiles[url]);
    return;
  }


  var data_received = false;

  var u = 'https://raw.githubusercontent.com'+url;
  if(DEBUG)
    console.log('... getted from '+u);

  https.get(u, function(clientres){
    clientres.on('data', function(d){
  	  if(!data_received){
  	     res.writeHead(200, {'Content-Type': mime});
  	     data_received = true;
      }
      res.write(d);
    });
    clientres.on('error', function(e){
        if(DEBUG){
    	     console.log('error');
    	     console.error(e);
    	  }
    	  res.writeHead(502);
        res.end("502 - Internal server error");
    });
    clientres.on('end', function(){
       res.end();
    })
  }).on('error', function(e){
    if(DEBUG){
  	    console.log('error main');
  	    console.error(e);
  	}
  	res.writeHead(502);
    res.end("502 - Internal server error (file not found)");
  });

}).listen(PORT);
