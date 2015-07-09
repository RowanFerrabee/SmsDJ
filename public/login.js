    window.onbeforeunload = logout;
    alert('a');
    function loadData() {
      var xmlhttp = new XMLHttpRequest();
      var userNumber = document.getElementById("number").value;
      window.sessionStorage.setItem("number", userNumber);

      xmlhttp.onreadystatechange = function () {
          var PartyID = xmlhttp.responseText;
          document.getElementById("number").value = "";
          document.getElementById("party").style.display = "none";
          document.getElementById("end-party").innerHTML = "<h1>Your PartyID is:<br>"+PartyID+"</h1>";
          var button = document.createElement("button");
          var text = document.createTextNode("End Party");
          button.appendChild(text);
          button.onclick = logout;
          document.getElementById("end-party").appendChild(button);
        }

        xmlhttp.open("GET","/newAdmin?name="+encodeURIComponent(window.sessionStorage.getItem("id"))+"&number="+encodeURIComponent(userNumber),true);
        xmlhttp.send();
      }
    }

    function logout() {
      var params = "name="+window.sessionStorage.getItem("id")+
              "&number=+1"+window.sessionStorage.getItem("number");
      var xmlhttp = new XMLHttpRequest();

      document.getElementById("end-party").innerHTML = "";
      document.getElementById("add-party").style.display = "initial";

      xmlhttp.open("POST","/deleteParty");
      xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      xmlhttp.onreadystatechange = function () {};
      xmlhttp.send(params);
    }