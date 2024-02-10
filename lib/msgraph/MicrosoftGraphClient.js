/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// (C) 2024 Joost Brugman
//
// This is a very limited and crude implementation of a task that processes emails from a mailbox. This was made in a hurry as a temporary solution
// and probably has a lot o bugs and issues that were not exposed in our specific use case. Feel free to use this at your own peril. Be very, very
// prudent in your testing to ensure this works as expected in your specific use case. According to general best practices this should be rewritten
// to be more robust and reliable. On that bases you could argue this is not a production ready solution. Again, use at your own risk. 
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const WebClient = require('./Client').Client;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Class:       MicrosofGraphClient
//
// Description: Provides access to querying Microsoft Defender logs
//
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = class MicrosofGraphClient {
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    constructor
    //
    // Description: Configures the Microsoft Defender Client
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(options) {
        this.tenantId = options.tenantId;
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.webClient = new WebClient();
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    authenticate
    //
    // Description: Retrieves a token to use as authentication for queries
    //
    // Powershell:  $tenantId = '00000000-0000-0000-0000-000000000000' # Paste your own tenant ID here
    //              $appId = '11111111-1111-1111-1111-111111111111' # Paste your own app ID here
    //              $appSecret = '22222222-2222-2222-2222-222222222222' # Paste your own app secret here
    //              
    //              $resourceAppIdUri = 'https://api.securitycenter.microsoft.com'
    //              $oAuthUri = "https://login.microsoftonline.com/$TenantId/oauth2/token"
    //              $body = [Ordered] @{
    //                  resource = "$resourceAppIdUri"
    //                  client_id = "$appId"
    //                  client_secret = "$appSecret"
    //                  grant_type = 'client_credentials'
    //              }
    //              $response = Invoke-RestMethod -Method Post -Uri $oAuthUri -Body $body -ErrorAction Stop
    //              $aadToken = $response.access_token
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async authenticate() {
        let response = await this.webClient.request({
            hostname: 'login.microsoftonline.com',
            port: 443,
            path: `/${this.tenantId}/oauth2/v2.0/token`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: this.webClient.encodeAsForm({
                client_id: this.clientId,
                scope: 'https://graph.microsoft.com/.default',
                client_secret: this.clientSecret,
                grant_type: 'client_credentials'
            }),
        });

        if (response.data.error)
            throw response.data;

        if (response.res.statusCode != 200)
            throw new Error('request-error');

        this.accessToken = response.data.access_token;
    }


    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async request(opts) {
        if (typeof opts == 'string') {
            opts = { path: opts }
        }
        let response = await this.webClient.request({
            hostname: 'graph.microsoft.com',
            port: 443,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json;charset=utf-8'
            },
            ...opts
        });
        if (response.data.error !== undefined) {
            throw response.data.error;
        }
        return response.data;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:
    //
    // Descrition:  // Array van objecten met daarin een id veld.
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async mailListMessages(userPrincipalName, folderId) {
        return (await this.request({
            path: `/v1.0/users/${userPrincipalName}/mailFolders/${folderId}/messages`
        })).value;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    mailListAttachments
    //
    // Descrition:  er komt een array terug met daarin items met name, contentType, contentBytes
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async mailListAttachments(userPrincipalName, messageId) {
        return (await this.request({
            path: `/v1.0/users/${userPrincipalName}/messages/${messageId}/attachments`
        })).value;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:
    //
    // Descrition:
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async mailMoveMessage(userPrincipalName, messageId, destinationId) {
        return (await this.request({
            method: 'POST',
            path: `/v1.0/users/${userPrincipalName}/messages/${messageId}/move`,
            data: JSON.stringify({
                destinationId: destinationId
            })
        })).value;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:
    //
    // Descrition: er komt een lijst van folders met daarin id en displayName
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async mailListMailFolders(userPrincipalName) {
        return (await this.request({
            path: `/v1.0/users/${userPrincipalName}/mailFolders?$top=50`
        })).value;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:
    //
    // Descrition: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async mailSendMail(userPrincipalName, message) {
        await this.request({
            method: 'POST',
            path: `/v1.0/users/${userPrincipalName}/sendMail`,
            data: JSON.stringify(message)
        });
    }


    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:
    //
    // Descrition: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async mailMarkAsRead(userPrincipalName, messageId) {
        await this.request({
            method: 'PATCH',
            path: `/v1.0/users/${userPrincipalName}/messages/${messageId}`,
            data: JSON.stringify({
                isRead: true
            })
        });
    }
}