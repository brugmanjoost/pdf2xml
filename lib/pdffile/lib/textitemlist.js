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
const Anchor = require('./anchor.js');

module.exports = class TextItemList {

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    //
    //
    //
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(textItems) {
        this.textItems = textItems ?? [];
        this.anchors = {}
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    //
    //
    //
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getTextItems() {
        return this.textItems;
    }

    getAnchors() {
        return this.anchors;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    //
    //
    //
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getIndexByRegexSequence(query, startAt) {
        startAt = startAt ?? 0;
        for (let searchIndex = startAt; searchIndex < this.textItems.length; searchIndex++) {
            for (let regexIndex = 0; (regexIndex < query.length) && ((searchIndex + regexIndex) < this.textItems.length); regexIndex++) {

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // What do we compare against what
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                let testedElement = this.textItems[searchIndex + regexIndex];
                let searchedRegex = query[regexIndex];

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // No match, go to next searchIndex
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                if (testedElement.str.match(searchedRegex) === null) break;

                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                // Match and all regexes matched? Found!
                /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                if (regexIndex == (query.length - 1)) return searchIndex;
            }
        }
        return null;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    findAnchors
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    findAnchors(anchorQueries) {
        this.anchors = {}
        for (let anchorName in anchorQueries) {
            let index = this.getIndexByRegexSequence(anchorQueries[anchorName]);
            if (index === null) throw new Error(`Anchor '${anchorName}' not found.`);
            this.anchors[anchorName] = new Anchor(index, this.textItems[index], anchorQueries[anchorName]);
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    getTextItemsInsideBoundingBox
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getTextItemsInsideBoundingBox(opts) {
        let top = null;
        let left = null;
        let bottom = null;
        let right = null;

        if (opts.topLeft !== undefined) {
            top = this.anchors[opts.topLeft].textItem.getTop();
            left = this.anchors[opts.topLeft].textItem.getLeft();
        }
        if (opts.bottomRight !== undefined) {
            bottom = this.anchors[opts.bottomRight].textItem.getTop();
            right = this.anchors[opts.bottomRight].textItem.getLeft();
        }
        if (opts.top !== undefined) top = typeof opts.top == 'string'
            ? this.anchors[opts.top].textItem.getTop()
            : opts.top;
        if (opts.left !== undefined) left = typeof opts.left == 'string'
            ? this.anchors[opts.left].textItem.getLeft()
            : opts.left;
        if (opts.bottom !== undefined) bottom = typeof opts.bottom == 'string'
            ? this.anchors[opts.bottom].textItem.getTop()
            : opts.bottom;
        if (opts.right !== undefined) right = typeof opts.right == 'string'
            ? this.anchors[opts.right].textItem.getLeft()
            : opts.right;

        return new TextItemList(
            this.textItems.filter((textItem) => {
                if (top    /**/ !== null) if (textItem.getTop() > top)      /**/ return false;
                if (left   /**/ !== null) if (textItem.getLeft() < left)    /**/ return false;
                if (bottom /**/ !== null) if (textItem.getTop() <= bottom)  /**/ return false;
                if (right  /**/ !== null) if (textItem.getLeft() >= right)  /**/ return false;
                return true;
            })
                .slice(opts.start ?? 0, opts.end));
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    getText
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getText(opts) {
        opts                     /**/ = opts ?? {}
        opts.newline             /**/ = opts.newline ?? '\n';
        opts.removeEmptyLines    /**/ = opts.removeEmptyLines ?? false;
        opts.trimLines           /**/ = opts.trimLines ?? false;

        let lastY, text = '';
        for (let item of this.textItems) {
            if (lastY == item.getTop() || !lastY) {
                text += item.str;
            }
            else {
                text += opts.newline + item.str;
            }
            lastY = item.getTop();
        }

        return text.split(opts.newline)
            .map(line => opts.trimLines ? line.trim() : line)
            .filter(line => opts.removeEmptyLines ? line != '' : true)
            .join(opts.newline);
    }


    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    getInt
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getInt() {
        return parseInt(this.getText());
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    getFloat
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getFloat() {
        let s = this.getText();
        if (s.substr(-3).substr(0, 1) == ',') return parseFloat(s.replaceAll('.', '').replace(',', '.'));
        if (s.substr(-3).substr(0, 1) == '.') return parseFloat(s.replaceAll(',', ''));
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    getContentFromBoundingBox
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getContentFromBoundingBox(opts) {
        let selection = this.getTextItemsInsideBoundingBox(opts);

        if (typeof opts.format == 'function') return opts.format(selection.getText());

        switch (opts.format) {
            case 'text':    /**/ return selection.getText(opts);
            case 'float':   /**/ return selection.getFloat();
            case 'int':     /**/ return selection.getInt();
            case 'list':    /**/
            default:        /**/ return selection;
        }
    }
}