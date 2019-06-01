$(document).ready(function() {

    if ( getCookie("phoneLogin") === null && getCookie("adwp") === null && getCookie("wss_subdomainclient") === null ) {
        // $("#phonePanel").hide();
        // $("#loginform").show();
        var msge = 'Login failed!';
            $("#mdlError p").html(msge);
            $("#mdlError").modal('show');

           
                $("#mdlError .modal-header").find('button').remove();
                $("#mdlError .modal-title").html('Error login   ');
                $("#mdlError").modal({ keyboard : false });
           
            $('#numDisplay').prop('disabled', 'disabled');
    }else{
        // $("#loginform").hide();
        // $("#phonePanel").show();
        $('#numDisplay').removeProp('disabled');
        $("#mdlError").modal('hide');
        // playDtmf=1;
        // return;
    }

    

    // Sibmit form
    $('#formSubmit').on('click',function() {
        if(ENABLE_LOG) console.log('SEND FORM CONFIGURATION');
        phoneUser = document.getElementById("phone_user").value;
        phoneADWP = document.getElementById("phone_secret").value;
        phoneSubDomainClient = document.getElementById("subdomainclient").value;

        if(phoneUser != ""){
            console.log('entre en user.. ' + phoneUser + 'guardo en cookie');
            document.cookie = "phoneLogin=" + encodeURIComponent( phoneUser );
        }

        if(phoneADWP != ""){
            console.log('entre en phoneADWP..' + phoneADWP + ' guardo en cookie');
            document.cookie = "adwp=" + btoa( phoneADWP );
        }

        if(phoneSubDomainClient != ""){
            console.log('entre en phoneSubDomainClient..' + encodeURIComponent( phoneSubDomainClient ) + ' guardo en cookie');
            document.cookie = "wss_subdomainclient=" + encodeURIComponent( phoneSubDomainClient );
        }
    });


    
    
function getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }

});





