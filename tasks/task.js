/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// (C) 2024 Joost Brugman
//
// This is a very limited and crude implementation of a task that processes emails from a mailbox. This was made in a hurry as a temporary solution
// and probably has a lot o bugs and issues that were not exposed in our specific use case. Feel free to use this at your own peril. Be very, very
// prudent in your testing to ensure this works as expected in your specific use case. According to general best practices this should be rewritten
// to be more robust and reliable. On that bases you could argue this is not a production ready solution. Again, use at your own risk. The way
// this should be written is probably by having a universal mailbox processor that can be configured to process any kind of email that would then
// call on a worker class to process the file. Here, due to time constraints, these things ended up being mixed together between this Task class
// and the OurCustomPDFFile class.
//
// It takes some environment variables that you may adjust during runtime, such as a microsoft graph application registration's client id and secret.
// It uses that to authenticate and then it will process all emails in the inbox of a given user. It works like so:
//
// - It reads unread emails in the inbox that have a matching subject line.
// - It processes the attached PDF.
// - If successul it moves the original email to a 'done' folder and sends an email to the inbox with a success report.
// - If failed it moves the original email to an 'error' folder and sends an email to the inbox with an error report.
//
// Modify lib/ourcustompdffile.js to match the structure of the PDF files you are processing. Its extractData() method is where you should
// put your code to get data from the pdf file and return it as a structure. The structure is then used to apply to a template to generate xml
// that is then sent to the webshop. The webshop URL, username and password are also environment variables that you can adjust during runtime.
//
// Modify lib/messagereport.js to change the structure of the email reports that are sent to the inbox.
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const fs                    /**/ = require('fs');
const axios                 /**/ = require('axios');
const uuid                  /**/ = require('uuid');
const Helpers               /**/ = require('../lib/helpers');
const MicrosofGraphClient   /**/ = require('../lib/msgraph/MicrosoftGraphClient.js');
const OurCustomPDFFile      /**/ = require('./lib/ourcustompdffile.js');
const MessageReport         /**/ = require('./lib/messagereport.js');

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//
//
//
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = class Task {

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    constructor() {
        this.preflightCheck                 /**/ = Helpers.Settings.boolean /**/('APP_TEST_PREFLIGHTCHECK');
        this.msgraphTenantId                /**/ = Helpers.Settings.string  /**/('APP_MSGRAPH_TENANTID');
        this.msgraphTenantId                /**/ = Helpers.Settings.string  /**/('APP_MSGRAPH_TENANTID');
        this.msgraphClientId                /**/ = Helpers.Settings.string  /**/('APP_MSGRAPH_CLIENTID');
        this.msgraphClientSecret            /**/ = Helpers.Settings.string  /**/('APP_MSGRAPH_CLIENTSECRET');
        this.mailboxUserPrincipalName       /**/ = Helpers.Settings.string  /**/('APP_MAILBOX_USERPRINCIPALNAME');
        this.mailboxFolderTodo              /**/ = Helpers.Settings.string  /**/('APP_MAILBOX_FOLDER_TODO');                // The name of the mailbox folder ToDo (e.g. 'Inbox')
        this.mailboxFolderDone              /**/ = Helpers.Settings.string  /**/('APP_MAILBOX_FOLDER_DONE');                // The name of the mailbox folder Done (e.g. 'Process-Done')
        this.mailboxFolderError             /**/ = Helpers.Settings.string  /**/('APP_MAILBOX_FOLDER_ERROR');               // The name of the mailbox folder Error (e.g. 'Process-Error')
        this.mailboxFolderSkipped           /**/ = Helpers.Settings.string  /**/('APP_MAILBOX_FOLDER_SKIPPED');             // The name of the mailbox folder Skipped (e.g. 'Process-Skipped')
        this.mailboxFolderLogVerwerkingen   /**/ = Helpers.Settings.string  /**/('APP_MAILBOX_FOLDER_LOGVERWERKINGEN');     // The name of the mailbox folder Log verwerkingen (e.g. 'Log-Verwerkingen')
        this.webshopURL                     /**/ = Helpers.Settings.string  /**/('APP_WEBSHOP_URL');
        this.webshopUsername                /**/ = Helpers.Settings.string  /**/('APP_WEBSHOP_USERNAME');
        this.webshopPassword                /**/ = Helpers.Settings.string  /**/('APP_WEBSHOP_PASSWORD');
        this.webshopTemplatePath            /**/ = Helpers.Settings.string  /**/('APP_WEBSHOP_TEMPLATE_PATH');              // ./tasks/templates
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    reportFatal
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async reportFatal(msg) {
        console.log();
        console.log();
        console.log('fatal', msg);
        process.exit();
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    applyDataToTemplate
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    applyDataToTemplate(template, data) {
        let output = '' + template;
        for (let itemName in data) {
            if (typeof data[itemName] == 'object') continue;
            output = output.replaceAll(`{{${itemName}}}`, ('' + data[itemName])
                .replaceAll('&', '&amp;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&apos;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
            );
            output = output.replaceAll(`[[${itemName}]]`, ('' + data[itemName]));
        }
        return output;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    prepareSetupGraphClient
    //
    // Description: Configure the Microsoft Graph client.
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async prepareSetupGraphClient() {
        console.log('MsGraph: Setup and authenticate client: Starting');
        await (this.msClient = new MicrosofGraphClient({
            tenantId:       /**/ this.msgraphTenantId,
            clientId:       /**/ this.msgraphClientId,
            clientSecret:   /**/ this.msgraphClientSecret,
        })).authenticate();
        console.log('MsGraph: Setup and authenticate client: Done');
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    prepareDetermineFoldersToUse
    //
    // Description: We get a list of folder from the mailbox of the given mailboxUserPrincipalName and in that list we try to find the mailboxes that we
    //              will use for our process.
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async prepareDetermineFoldersToUse() {
        let listFolderData = await this.msClient.mailListMailFolders(this.mailboxUserPrincipalName);
        for (let folderData of listFolderData) {
            if (folderData.displayName == this.mailboxFolderTodo)               /**/ this.mailboxFolderTodo = folderData;
            if (folderData.displayName == this.mailboxFolderDone)               /**/ this.mailboxFolderDone = folderData;
            if (folderData.displayName == this.mailboxFolderError)              /**/ this.mailboxFolderError = folderData;
            if (folderData.displayName == this.mailboxFolderSkipped)            /**/ this.mailboxFolderSkipped = folderData;
            if (folderData.displayName == this.mailboxFolderLogVerwerkingen)    /**/ this.mailboxFolderLogVerwerkingen = folderData;
        }
        if (typeof this.mailboxFolderTodo == 'string')                          /**/ this.reportFatal(`Identify folders: Folder '${this.mailboxFolderTodo}' not found. We only see the first 50 folders. Do not add additional folders to the mailbox.`);
        if (typeof this.mailboxFolderDone == 'string')                          /**/ this.reportFatal(`Identify folders: Folder '${this.mailboxFolderDone}' not found. We only see the first 50 folders. Do not add additional folders to the mailbox.`);
        if (typeof this.mailboxFolderError == 'string')                         /**/ this.reportFatal(`Identify folders: Folder '${this.mailboxFolderError}' not found. We only see the first 50 folders. Do not add additional folders to the mailbox.`);
        if (typeof this.mailboxFolderSkipped == 'string')                       /**/ this.reportFatal(`Identify folders: Folder '${this.mailboxFolderSkipped}' not found. We only see the first 50 folders. Do not add additional folders to the mailbox.`);
        if (typeof this.mailboxFolderLogVerwerkingen == 'string')               /**/ this.reportFatal(`Identify folders: Folder '${this.mailboxFolderLogVerwerkingen}' not found. We only see the first 50 folders. Do not add additional folders to the mailbox.`);

        console.log(`Identify folders: The emails of type ToDo             are in: '${this.mailboxFolderTodo.displayName}'.`);
        console.log(`Identify folders: The emails of type Done             are in: '${this.mailboxFolderDone.displayName}'.`);
        console.log(`Identify folders: The emails of type Error            are in: '${this.mailboxFolderError.displayName}'.`);
        console.log(`Identify folders: The emails of type Skipped          are in: '${this.mailboxFolderSkipped.displayName}'.`);
        console.log(`Identify folders: The emails of type Log verwerkingen are in: '${this.mailboxFolderLogVerwerkingen.displayName}'.`);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    executeAcquireListOfMessagesTodo
    //
    // Description: We download a list of messages that is present in the folderTodo folder. Those are the ones that still require processing.
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async executeAcquireListOfMessagesTodo() {
        console.log(`MsGraph: Acquire list of messages ToDo: Starting`);
        this.messagesToDo = await this.msClient.mailListMessages(this.mailboxUserPrincipalName, this.mailboxFolderTodo.id);
        console.log(`MsGraph: Acquire list of messages ToDo: Found ${this.messagesToDo.length} messages.`);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    executeSingleAttachment
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async executeSingleAttachment(attachment, messageReport) {

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Extract data from the PDF file
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let pdfFile = new OurCustomPDFFile();
        await pdfFile.open(Buffer.from(attachment.contentBytes, 'base64'));

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // @NOTE: In the 
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let data = await pdfFile.extractData();

        messageReport.log('    Data uit de PDF : ' + JSON.stringify(data, null, '  ').replaceAll('\n', '\n                      ').trim());

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Apply templates to generate xml
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        data.itemOutList = '';
        for (let lineItem of data.lineItems)
            data.itemOutList += this.applyDataToTemplate(fs.readFileSync(`${this.webshopTemplatePath}/orderitem.xml`, 'utf-8'), lineItem);
        let xmlDocument = this.applyDataToTemplate(fs.readFileSync(`${this.webshopTemplatePath}/order.xml`, 'utf-8'), data);
        messageReport.attach('document.xml', xmlDocument);

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Don't send on preflight check
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (this.preflightCheck) {
            messageReport.log('    Send to webshop : Not doing it (preflight check)');
            return;
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Actually send
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        messageReport.log('    Send to webshop : Starting');
        let httpResponse = await axios.post(this.webshopURL, xmlDocument, {
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': `Basic ${Buffer.from(this.webshopUsername + ':' + this.webshopPassword).toString('base64')}`,
            },
        });
        messageReport.log(`    HTTP Response   : ${httpResponse.status} ${httpResponse.statusText}`);

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // We need a 200 to succeeed
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (httpResponse.status != 200) throw new Error('Request failed with status code ' + httpResponse.status);

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // There must be no errors
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        messageReport.log(`    Webshop message : ${httpResponse.data.message}`);
        messageReport.log(`    Webshop errors  : ${httpResponse.data.errors ?? '(none)'}`);

        if (httpResponse.data.errors) throw new Error('Webshop returned errors.');
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    executeProcessEachMessage
    //
    // Description: To process a message we download all of it's attachments and get each attachment processed. If there are no exceptions we'll
    //              move the message to the done folder. If there are exceptions, however, we'll move the message to the error folder.
    //
    //              This is also where we do all the message filtering so that we only process attachments from messages that fit the bill.
    //
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async executeProcessSingleMessage(message) {

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Move reporting messages to the reporting folder
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (message.subject.match(/^PDF2XML (Skipped|Done|Error):/) !== null) {
            await this.msClient.mailMoveMessage(this.mailboxUserPrincipalName, message.id, this.mailboxFolderLogVerwerkingen.id);
            return;
        }
        if (message.subject.match(/^PDF2XML (Preflight):/) !== null) {
            return;
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Process all other messages
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let messageReport = new MessageReport(this, message.subject)

        messageReport.log(`Message: ${message.id}`);
        messageReport.log(`  isRead            : ${message.isRead}`);
        messageReport.log(`  receivedDateTime  : ${message.receivedDateTime}`);
        messageReport.log(`  subject           :'${message.subject}`);

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Get applicable attachments.
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let applicableAttachments = (await this.msClient.mailListAttachments(this.mailboxUserPrincipalName, message.id)).filter((attachment) => {
            messageReport.log(`  Attachment        : ${attachment.id}`);
            messageReport.log(`    name            : ${attachment.name}`);
            let invalidations = []
            if (attachment.name.match(OurCustomPDFFile.MATCH_ATTACHMENT_FILENAME) == null)    /**/ invalidations.push('Invalid name (expecting a specific format.');
            if (attachment.contentType != 'application/pdf')            /**/ invalidations.push('Invalid content-Type (expecting: application/pdf)');
            invalidations.forEach((line) => messageReport.log(`    Invalid because : ${line}`));
            return invalidations.length == 0;
        });

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Determine if message must be ignored
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let ignores = []
        if (message.isRead !== false) /**/ ignores.push('Message is already read');
        if (ignores.length) {
            ignores.forEach((line) => messageReport.log(`  Ignored because   : ${line}`));
            return;
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Determine if message meets validation criteria
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let invalidations = []
        if (message.subject.match(OurCustomPDFFile.MATCH_SUBJECT) == null)                                               /**/ invalidations.push('Subject mismatch');
        if (applicableAttachments.length < 1)                                                           /**/ invalidations.push('Too few applicable attachments');
        if (applicableAttachments.length > 1)                                                           /**/ invalidations.push('Too many applicable attachments');
        if (invalidations.length) {
            invalidations.forEach((line) => messageReport.log(`  Invalid because   : ${line}`));
            messageReport.log('  Completion        : Moving message to skipped folder.');
            await messageReport.send('Skipped');
            await this.msClient.mailMoveMessage(this.mailboxUserPrincipalName, message.id, this.mailboxFolderSkipped.id);
            return;
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        try {
            await this.executeSingleAttachment(applicableAttachments[0], messageReport);

            if (this.preflightCheck) {
                messageReport.log('  Completion        : Not moving to done folder (preflight).');
                await messageReport.send('Preflight');
            } else {
                messageReport.log('  Completion        : Moving message to done folder.');
                await this.msClient.mailMoveMessage(this.mailboxUserPrincipalName, message.id, this.mailboxFolderDone.id);
                await messageReport.send('Done');
            }
        }
        catch (error) {
            messageReport.log('    Error           : ' + (error instanceof Error ? error.message : ('' + error)));
            if (error instanceof Error) messageReport.log('    Stack           : ' + error.stack.split('\n').slice(1).map(s => s.trim()).join('\n                      '));


            if (this.preflightCheck) {
                messageReport.log('  Completion        : Not moving to error folder (preflight).');
            } else {
                messageReport.log('  Completion        : Moving message to error folder.');
                await this.msClient.mailMoveMessage(this.mailboxUserPrincipalName, message.id, this.mailboxFolderError.id);
            }
            await messageReport.send('Error');
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Mark message as read
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        await this.msClient.mailMarkAsRead(this.mailboxUserPrincipalName, message.id);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    execute
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async execute() {
        await this.prepareSetupGraphClient();
        await this.prepareDetermineFoldersToUse();
        await this.executeAcquireListOfMessagesTodo();
        for (let message of this.messagesToDo) await this.executeProcessSingleMessage(message);
    }
}
