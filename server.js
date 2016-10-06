require('xmlhttprequest');
var io = require('socket.io')(4000);
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

io.on('connection', function(socket){
  socket.on('message', function(data){
    io.emit('message', data);
  });

  socket.on('updateOnlineList', function(accountId, userId, orderId) {
    //Update who's online per account
    socket.handshake.query.userId = userId
    socket.handshake.query.accountId = accountId
    socket.handshake.query.orderId = orderId

    var xhr = new XMLHttpRequest();
    function reqListener () {
      response = JSON.parse(this.responseText);
      series = response['results'][0]['series']

      latestOnlineUsers = []
      if (series) {
        latestOnlineUsers = series[0]['values'][0][1].split(',');
      }

      updatedOnlineUsers = null;

      if(latestOnlineUsers && latestOnlineUsers.indexOf(userId) < 0){
        latestOnlineUsers.push(userId)
        updatedOnlineUsers = latestOnlineUsers.toString();
      }

      if(updatedOnlineUsers) {
        var data_string = "account_" + accountId + " value=" + '"' + updatedOnlineUsers + '"'
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:8086/write?db=tradegecko_chat", true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.send(data_string);
        io.sockets.in(orderId).emit('updateOnlineList', updatedOnlineUsers);
      }
    }

    xhr.addEventListener("load", reqListener);
    xhr.open("GET", "http://localhost:8086/query?q=SELECT+*+FROM+account_" + accountId + "+ORDER+BY+time+DESC+LIMIT+1&db=tradegecko_chat", true);
    xhr.send();
  });

  socket.on('online', function(userId) {
    console.log('Setting up direct message', userId);
    socket.join(userId);
  });

  socket.on('subscribe', function(room) {
      console.log('joining room', room);
      socket.join(room);

      var xhr = new XMLHttpRequest();
      function reqListener () {
        response = JSON.parse(this.responseText);
        series = response['results'][0]['series']
        if (series) {
          data_arrays = series[0]['values'];
        } else {
          return [];
        }
        data = data_arrays.map(function(data_array){
          return {room: room, userId: data_array[1], message: data_array[2], timestamp: data_array[0]};
        });

        io.sockets.in(room).emit('message', data);
      }

      xhr.addEventListener("load", reqListener);
      xhr.open("GET", "http://localhost:8086/query?q=SELECT+*+FROM+order_" + room + "&db=tradegecko_chat", true);
      xhr.send();
    })

  socket.on('unsubscribe', function(room) {
    console.log('leaving room', room);
    socket.leave(room);
  })

  socket.on('notify', function(userId, orderId) {
    console.log("Notify chat in " + orderId);
    io.sockets.in(userId).emit('invite', orderId);
  }),

  socket.on('send', function(data) {
    console.log('sending message');
    io.sockets.in(data.room).emit('message', data);
    var xhr = new XMLHttpRequest();
    var data_string = "order_" + data.room + ",userId=" + data.userId + " value=" + '"' + data.message + '"'

    xhr.open("POST", "http://localhost:8086/write?db=tradegecko_chat", true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.send(data_string);
  })
  console.log("connected");

  socket.on('disconnect', function() {
    console.log('Got disconnect!');
    var query = socket.handshake.query
    var userId = query.userId;
    var accountId = query.accountId;
    var orderId = query.orderId;

    var xhr = new XMLHttpRequest();
    function reqListener () {
      response = JSON.parse(this.responseText);
      series = response['results'][0]['series']

      if (series) {
        latestOnlineUsers = series[0]['values'][0][1].split(',');
      } else {
        return [];
      }

      updatedOnlineUsers = null;

      if(latestOnlineUsers){
        while ((matchedIndex = latestOnlineUsers.indexOf(userId)) !== -1) {
          latestOnlineUsers.splice(matchedIndex, 1);
        }
        updatedOnlineUsers = latestOnlineUsers.toString();
      }

      if(updatedOnlineUsers) {
        var data_string = "account_" + accountId + " value=" + '"' + updatedOnlineUsers + '"'
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:8086/write?db=tradegecko_chat", true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.send(data_string);
        io.sockets.in(orderId).emit('updateOnlineList', updatedOnlineUsers);
      }
    }

    xhr.addEventListener("load", reqListener);
    xhr.open("GET", "http://localhost:8086/query?q=SELECT+*+FROM+account_" + accountId + "+ORDER+BY+time+DESC+LIMIT+1&db=tradegecko_chat", true);
    xhr.send();
  });
});
