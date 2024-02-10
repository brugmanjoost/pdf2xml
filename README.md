# pdf2xml
Quick and dirty webjob to temporarily extract data from pdf and convert to xml. Not maintained. Not well tested.

I wrote this exclusively to solve a temporary issue where we could not connect our purchasing solution to an external webshop. Sadly our purchasing software produced a PDF in an Office365 mailbox. This script read the mailbox, gets the PDF attachment, extracts tabular data, converts to the XML API format of a webshop and forwards the data.

Use at your own risk. No warranties whatsoever. Tested only on our usecase and may very well fail in yours.

Consider this not maintained.

## How to use this

There is a demo folder. You cd into it and call demo1.js for a demo extracting tabular data from a provided demo pdf:
```
node demo1.js
```

Then in the root you can find show.js. Call it like this to get a dump on screen of all text elements found in the provided pdf:
```
node show.js <path-to-your-pdf.pdf>
```

To run a webjob, upload the entire folder into a Azure App Service web job or equivalent. Configure these environment variables:

APP_TEST_PREFLIGHTCHECK: true/false: to indicate if data must be sent to the webshop. This will give you output, without actually sending data.

APP_MSGRAPH_TENANTID, APP_MSGRAPH_CLIENTID, APP_MSGRAPH_CLIENTSECRET: Your Azure AD app registration's details with persmissions to read a mailbox and to send mail on behalf of a mailbox. Sending is used to send reports into the mailbox for monitoring. Very crude. Again, good enough as a temp solution.

APP_MAILBOX_USERPRINCIPALNAME: The UPN of the mailbox from which to read / for which to send.

APP_MAILBOX_FOLDER_TODO, APP_MAILBOX_FOLDER_DONE, APP_MAILBOX_FOLDER_ERROR, APP_MAILBOX_FOLDER_SKIPPED, APP_MAILBOX_FOLDER_LOGVERWERKINGEN: These are names of folders in the root of the mailbox where emails will be sent. Typically you name the TODO folder 'Inbox'. The others can be any name. The LOGVERWERKINGEN is where logfiles will be stored.

APP_WEBSHOP_URL, APP_WEBSHOP_USERNAME, APP_WEBSHOP_PASSWORD are details to connect to the webshop.

APP_WEBSHOP_TEMPLATE_PATH points to a folder with two files: order.xml and orderitem.xml which are then used as payload to send to the webshop. This is very specific to your case and you may have to change this. These files are currently in /tasks/templates.

Finally, modify /tasks/lib/ourcustompdffile.js to implement your own data extraction for your specific PDF format based on what you learn from the demo. Also, modify /tasks/lib/messagereport.js to generate and send a mailreport as per your preference.


