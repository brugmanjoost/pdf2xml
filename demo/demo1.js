/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// (C) 2024 Joost Brugman
//
// node demo1.js
//
// This is a very limited and crude implementation of a task that processes emails from a mailbox. This was made in a hurry as a temporary solution
// and probably has a lot o bugs and issues that were not exposed in our specific use case. Feel free to use this at your own peril. Be very, very
// prudent in your testing to ensure this works as expected in your specific use case. According to general best practices this should be rewritten
// to be more robust and reliable. On that bases you could argue this is not a production ready solution. Again, use at your own risk. 
//
// Use this to get an understanding of how to use this library. It demonstrates reading a pdf file and extracting data from it, both individual
// fields and a table.
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const fs = require('fs');
const PDFFile = require('../lib/pdffile');

(async () => {
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Read PDF file
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let pdfFile = new PDFFile();
    let pdfContents = fs.readFileSync('demo1.pdf');
    await pdfFile.open(pdfContents);

    await getAddressee(pdfFile);
    await getPurchaseOrderNumber(pdfFile);
    await getTable(pdfFile);
})();

async function getAddressee(pdfFile) {

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Acquire anchors. Warning: this overwrites pdfFile.anchors. Not very nice and room for improvement.
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log();
    console.log('DEMO: Let\'s get the addressee:')
    console.group();
    console.log('The actual addressee data is below the word Addressee:, above the word Delivery address: and left of the word Date, Purchase Order Number and Your');
    console.log('reference. We will use Purchase Order Number as the anchor to identify the right side of the box that encloses the addressee.');
    console.log();
    console.group();
    pdfFile.findAnchors({
        addressee: [                    // This is the name of the anchor we are creating
            /Addressee:/,               // It searches for the regular expression /Addressee:/
        ],
        deliveryAddress: [
            /Delivery Address:/,
        ],
        purchaseOrderNumber: [
            /Purchase Order number:/i,  // Using the i flag for case insensitivity
        ],
    });
    let anchors = pdfFile.getAnchors();
    console.log(anchors);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Calculate bounding box
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Let\'s calculate the bounding box for the addressee:');
    console.group();
    console.log();
    let boxTop      = anchors.addressee.textItem.getBottom();
    let boxLeft     = anchors.addressee.textItem.getLeft();
    let boxRight    = anchors.purchaseOrderNumber.textItem.getLeft();
    let boxBottom   = anchors.deliveryAddress.textItem.getTop();
    console.log('top:    ' + boxTop);
    console.log('left:   ' + boxLeft);
    console.log('bottom: ' + boxBottom);
    console.log('right:  ' + boxRight);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Get text elements in bounding box. This is not a sophisticated function. I just gets all the text elements that have their topleft inside the
    // bounding box.
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Now we use that box to find all text elements that are inside the box:');
    console.log('We get a new instance of a TextItemList that contains just these text elements.');
    let elements = pdfFile.getTextItemsInsideBoundingBox({top: boxTop, left: boxLeft, right: boxRight, bottom: boxBottom });
    console.group();
    console.log();
    console.log(elements);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Get the contents.
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('And now we have the address:'); 
    console.group();
    console.log('Name:        ' + elements.getTextItems()[0].getText());
    console.log('Street:      ' + elements.getTextItems()[1].getText());
    console.log('Postal code: ' + elements.getTextItems()[2].getText());
    console.log('City:        ' + elements.getTextItems()[3].getText());
    console.log();
    console.groupEnd();
    console.groupEnd();
}

async function getPurchaseOrderNumber(pdfFile) {

    console.log('DEMO: Get Purchase Order Number');
    console.group();
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('We will draw a box around the top of PurchaseOrderNumber as top, the top of Your Reference as bottom, the right of');
    console.log('PurchaseOrderNumber as left and we will not specify a right so anything all the way to the right side of the page');
    console.log('will be included.');
    console.log();
    console.group();
    pdfFile.findAnchors({
        purchaseOrderNumber: [
            /Purchase Order number:/i,  // Using the i flag for case insensitivity
        ],
        yourReference: [
            /Your reference:/i,
        ],
    });
    let anchors = pdfFile.getAnchors();
    console.log(anchors);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Calc the box
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Calculate the box');
    console.group();
    console.log();
    let boxTop      = anchors.purchaseOrderNumber.textItem.getTop();
    let boxLeft     = anchors.purchaseOrderNumber.textItem.getRight()
    let boxRight    = null;
    let boxBottom   = anchors.yourReference.textItem.getTop();
    console.log('top:    ' + boxTop);
    console.log('left:   ' + boxLeft);
    console.log('bottom: ' + boxBottom);
    console.log('right:  ' + boxRight);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Get the elements
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Get all the elements in the box:');
    console.group();
    console.log();
    let elements = pdfFile.getTextItemsInsideBoundingBox({top: boxTop, left: boxLeft, right: boxRight, bottom: boxBottom });
    console.log(elements);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Get the text
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Now we can just ask the TextItemList to give us the text of all items concatenated.');
    console.group();
    console.log();
    console.log('Purchase Order Number: ' + elements.getText());
    console.log();
    console.groupEnd();

    console.groupEnd();
}


async function getTable(pdfFile) {
    
    console.log('DEMO: Getting a table is more complex. We will do this by filtering the text element list in multiple steps.');
    console.group();
    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Entire table: Get bounding box anchors
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('In the first step we will find all the text elements in the table. The table is located from the topleft of # to some bottom right');
    console.log('but certainly above the word Total. We will use them as top and bottom of the bounding box. We will omit left and right to get');
    console.log('All elements in the table.');
    console.log();
    console.group();
    pdfFile.findAnchors({
        tableTop: [
            /^#$/,
        ],
        tableBottom: [
            /Total:/i,
        ],
    });
    console.log(pdfFile.getAnchors());
    console.log();
    console.groupEnd();
    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Entire table: Get elements
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('This gets us the following elements (still a long list):');
    console.log();
    console.group();
    let posTableTop = pdfFile.getAnchors().tableTop.textItem.getTop();
    let posTableBottom = pdfFile.getAnchors().tableBottom.textItem.getTop(); // not getBottom because we want to exclude the word Total
    let tableElements = pdfFile.getTextItemsInsideBoundingBox({top: posTableTop, bottom: posTableBottom });
    console.log(tableElements);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Columns: Get all columns
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('In this list of text elements we find the elements that make up the headers of the table. If we know their positions then we');
    console.log('know the left positions of each column.');
    console.log();
    console.log('Note that sometimes a search may yield multiple elements. Both the words Product and Total also occur elsewhere in the table.');
    console.log('You risk getting the wrong elements. findAnchors currently returns the first element that matches the regular expression.');
    console.log('That means the header is returned first. Otherwise, if we would get multiple items, then we could take the top of # and');
    console.log('filter the the search results to contain only elements that have the same top positions as #.');
    console.log();
    console.log();
    console.log();
    console.group();
    tableElements.findAnchors({
        headerDescription: [
            /^Description$/,
        ],
        headerProductCode: [        // The word product code is split into two text elements. Some PDF generators do this. So we provide two
            /^Product$/,            // regular expressions that must match in successive order.
            /^code$/,
        ],
        headerAmount: [
            /^Amount$/,
        ],
        headerQuantity: [
            /^Quantity$/,
        ],
        headerTotal: [
            /^Total$/,
        ],
    });
    console.log(tableElements.getAnchors());
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Columns: What anchors elements are actually part of the header?
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Now we can create column properties based on the positions of the header elements.');
    console.log('Not how text alignment is important. The header Total is aligned right. This means that the left position of the text');
    console.log('Is actually not at the left position of the column. So for various such columns we will have to take the right');
    console.log('position of the preceeding column as the starting point of the next column.');
    console.log('');
    console.log('Note how this also means we have a risky area between Product code and Amount. The header for Product Code is left aligned.');
    console.log('The header for Amount is right aligned. In our aproach we want to use these text elements to find the actual column divider');
    console.log('position between them but the text will not show that. It is a typical case of ambiguity you have to deal with.');
    console.log('We will leave this issue for now, assuming that the right side of the word code is actually the divider.')
    console.log();
    console.log('You could come up with different approaches, e.g. finding values under Amount that have the same right position as the header.');
    console.log();
    console.group();
    const columns = {
        index: {
            left:   pdfFile.getAnchors().tableTop.textItem.getLeft(),
            right:  tableElements.getAnchors().headerDescription.textItem.getLeft(),
        },
        description: {
            left:   tableElements.getAnchors().headerDescription.textItem.getLeft(),
            right:  tableElements.getAnchors().headerProductCode.textItem.getLeft(),
        },
        productCode: {
            left:   tableElements.getAnchors().headerProductCode.textItem.getLeft(),
            right:  tableElements.getAnchors().headerProductCode.textItem.getRight(),
        },
        amount: {
            left:   tableElements.getAnchors().headerProductCode.textItem.getRight(),
            right:  tableElements.getAnchors().headerAmount.textItem.getRight(),
        },
        quantity: {
            left:   tableElements.getAnchors().headerAmount.textItem.getRight(),
            right:  tableElements.getAnchors().headerQuantity.textItem.getRight(),
        },
        total: {
            left:   tableElements.getAnchors().headerQuantity.textItem.getRight(),
            right:  null // all the way to the right
        }
    }
    console.log(columns);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Rows: 
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Looking for elements that are exclusively digits, directly under the table header # we find textElements that indicate');
    console.log('not only the line number, but also the vertical position of each line. They will be poisoned with the uuidv4 code that is');
    console.log('on each line, but we will get there...');
    console.log();
    console.group();
    let indexTop = pdfFile.getAnchors().tableTop.textItem.getBottom();
    let indexLeft = pdfFile.getAnchors().tableTop.textItem.getLeft();
    let indexRight = tableElements.getAnchors().headerDescription.textItem.getLeft();
    let indexElements = tableElements.getTextItemsInsideBoundingBox({top: indexTop, left: indexLeft, right: indexRight, bottom: null });
    console.log(indexElements);
    console.log();
    console.groupEnd();
    
    console.log('Depending on your table structure you can choose different strategies to further specify. We will order these elements from');
    console.log('high up on the page to lower on the page. They seem to be ordered that way already, but just to be sure. This will create');
    console.log('pairs, where each pair is an item with an index followed by an item of a uuidv4');
    console.log();
    console.group();
    indexElements.textItems.sort((a, b) => b.getTop() - a.getTop());
    console.log(indexElements);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Now we can create the rows
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Now we can derive the rows from the index positions. We will also get the uuid');
    console.log();
    console.group();
    let rows = [];
    let elems = indexElements.getTextItems(); // Dirty We are going to modify indexElements, but hey - this is not a fully developed library
    while(elems.length) {
        let itemIndex = elems.shift();
        let itemUuid = elems.shift();

        rows.push({
            top:    itemIndex.getTop(),
            bottom: itemUuid.getTop(),
            index:  itemIndex.getText(),
            uuid:   itemUuid.getText(),
        })
    }
    console.log(rows);
    console.log();
    console.groupEnd();

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Get table contents
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('Now that we have rows and columns we have intersection points. We can use these to get the contents of the table. After this');
    console.log('step you can normalize the data.');
    console.log();
    console.group();
    let contents = [];

    for(let row of rows) {
        let rowContents = {
            index: row.index,
            uuid: row.uuid,
        }
        for(let column in columns) {
            let left = columns[column].left;
            let right = columns[column].right;
            let columnContents = tableElements.getTextItemsInsideBoundingBox({top: row.top, bottom: row.bottom, left: left, right: right});
            rowContents[column] = columnContents.getText();
        }
        contents.push(rowContents);
    }
    console.log(contents);
    console.log();
    console.groupEnd();

    console.groupEnd();
}