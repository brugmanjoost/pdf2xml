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
const https = require('https');
const ContentDisposition = require('./ContentDisposition.js');
const ContentType = require('./ContentType.js');
const Helpers = require('./Helpers.js');

function rpad(s, length) {
    return (s + ' '.repeat(length)).substr(0, length);
}

module.exports = class Client {

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    	
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(options) {
        this.cookies = {}
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    	
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getCookies() {
        let pairs = []
        for (let name in this.cookies)
            pairs.push(this.cookies[name] === undefined ? name : `${name}=${this.cookies[name]}`);
        if (pairs.length == 0)
            return {}
        else
            return { Cookie: pairs.join('; ') }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    	
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    saveCookies(res) {
        if (res.headers['set-cookie'] !== undefined) {
            res.headers['set-cookie'].forEach((cookieHeader) => {
                this.cookies = {
                    ...this.cookies,
                    ...Helpers.extractMultipairValues(cookieHeader)
                }
            });
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    	
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async request(options) {
        return new Promise((resolve, reject) => {

            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // Construct headers
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            let headers = {
                ...(options.headers === undefined ? {} : options.headers),
                ...options.data === undefined ? {} : { 'Content-Length': Buffer.byteLength(options.data) },
                ...this.getCookies(),
            }

            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // Output request
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            const req = https.request({
                hostname: options.hostname,
                port: options.port,
                path: options.path,
                method: options.method,
                headers: headers,
            }, (res) => {
                const contentDisposition = new ContentDisposition(res.headers['content-disposition'])
                const contentType = new ContentType(res.headers['content-type'])
                this.saveCookies(res);

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // Option 1: Pipe to caller
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                if (options.stream !== undefined)
                    res.pipe(options.stream);

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // Option 2: Collect for caller
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                let data = [];
                if (options.stream === undefined) {
                    if (contentDisposition.type != 'attachment')
                        res.setEncoding(contentType.charset || 'utf8');
                    res.on('data', (chunk) => {
                        data.push(chunk);
                    });
                }

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // Complete
                //
                // - Attachments are returned as a buffer
                // - application/json is returned as an object
                // - all other data is returned as string
                //
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                res.on('end', () => {
                    if (contentDisposition.type == 'attachment')
                        data = Buffer.concat(data);
                    else {
                        data = data.join('');
                        if (res.headers['content-type'] !== undefined) {
                            if (res.headers['content-type'].split(';')[0].trim() == 'application/json') {
                                try { data = JSON.parse(data); }
                                catch (error) { return reject(error); }
                            }
                        }
                    }

                    resolve({
                        res: res,
                        data: data,
                        contentDisposition: contentDisposition
                    });
                });
            });
            req.on('error', reject);
            if (options.data !== undefined) req.write(options.data);
            req.end();
        });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    	
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    encodeAsForm(parameters) {
        let result = []
        for (let name in parameters) {
            let rawValue = parameters[name];
            if (Array.isArray(rawValue)) {
                rawValue.forEach((value) => {
                    result.push(`${name}=${encodeURIComponent(value)}`);
                });
            }
            else
                result.push(`${name}=${encodeURIComponent(parameters[name])}`);
        }
        return result.join('&');
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    	
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    requestForm(options) {
        options.data = this.encodeAsForm(options.data);
        options.headers = {
            ...(options.headers === undefined ? {} : options.headers),
            ...{
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            }
        }
        return this.request(options)
    }
}