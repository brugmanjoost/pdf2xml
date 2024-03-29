const csv = require('csv-parse/sync');

function getValue(name, defaultValue) {

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Get value from environment
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let value = process.env[name];

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Handle default values
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    if (value === undefined) value = defaultValue;
    if (value === undefined) throw new Error(`Configuration error: Missing environment variable ${name}`);

    return value;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function error(name, msg) {
    throw new Error(`Configuration error: Invalid value for environment variable ${name}. ${msg}`);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getString(name, defaultValue) {
    return getValue(name, defaultValue);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getStringList(name, opts) {
    opts = opts ?? {}
    opts.defaultValue = opts.defaultValue ?? undefined;
    opts.min = opts.min ?? null;
    opts.max = opts.max ?? null;
    opts.delimiter = opts.delimiter ?? ',';
    opts.quote = opts.quote ?? '"';
    opts.escape = opts.escape ?? '\\';
    opts.encoding = opts.encoding ?? 'utf-8';

    let rawLine = getValue(name, '');               // Makes both no presence of a variable and an empty string go to default aswell.
    if (rawLine == '') return opts.defaultValue;    // Apparently a default value was passed that is not a string.

    let entireFile = csv.parse(rawLine, {
        bom: false,
        delimiter: opts.delimiter,
        quote: opts.quote,
        escape: opts.escape,
        columns: false,
        encoding: opts.encoding,
        raw: false,
    });

    let decodedLine = entireFile[0];

    if (opts.min !== null) if (decodedLine.length < opts.min) error(name, `Expecting at least ${opts.min} values.`);
    if (opts.max !== null) if (decodedLine.length > opts.max) error(name, `Expecting at most ${opts.max} values.`);

    return decodedLine;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getBoolean(name, defaultValue) {
    switch (getValue(name, defaultValue)) {
        case '0':
        case 'false':
        case false:
            return false;
        case '1':
        case 'true':
        case true:
            return true;
        default:
            error(name, `Expecting 1, 0, true or false.`);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getInteger(name, defaultValue) {
    let value = getValue(name, defaultValue);
    let valueInt = parseInt(value);
    if (('' + valueInt) != value) error(name, `Expecting digits only.`);
    return valueInt;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getEnum(name, valueOptions, defaultValue) {
    let value = getValue(name, defaultValue);
    if (valueOptions.indexOf(value) == -1) error(name, `Expecting digits only.`);
    return value;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getUrl(name, defaultValue) {
    let value = getValue(name, defaultValue);
    if (value === null) return null;
    try {
        new URL(value);
        return value;
    }
    catch (e) {
        error(name, `Expecting valid url.`);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getDate(name, defaultValue) {
    let value = getValue(name, defaultValue);
    if (value === null) return null;
    return new Date(value);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    string: getString,
    boolean: getBoolean,
    integer: getInteger,
    url: getUrl,
    enum: getEnum,
    stringList: getStringList,
    date: getDate,
}
