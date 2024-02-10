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
const Helpers = require('./Helpers.js');

module.exports = class ContentDisposition {
    constructor(header) {
        this.type = undefined;

        if (header === undefined) return;

        let disposition = Helpers.extractMultipairValues(header);
        if ('inline' in disposition) this.type = 'inline';
        if ('attachment' in disposition) this.type = 'attachment';
        if ('form-data' in disposition) this.type = 'form-data';

        switch (this.type) {
            case 'attachment':
                this.filename = Helpers.clearQuotes(disposition['filename']);
                this.creationDate = disposition['creation-date'];
                this.modificationDate = disposition['modification-date'];
                this.readDate = disposition['read-date'];
                this.size = disposition['size'];
                this.handling = disposition['handling'];
                break;
            case 'form-data':
                this.name = Helpers.clearQuotes(disposition['name']);
                this.filename = Helpers.clearQuotes(disposition['filename']);
                break;
            case 'inline':
            default:
                break;
        }
    }
}