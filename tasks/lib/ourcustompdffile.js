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
const Helpers = require('../../lib/helpers');
const PDFFile = require('../../lib/pdffile');

class OurCustomPDFFile extends PDFFile {

    MATCH_SUBJECT               = /^(Purchase order|Inkooporder) PO[0-9]{11} (from|van) /
    MATCH_ATTACHMENT_FILENAME   = /^PO[0-9]{11}\.pdf$/;

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    tableGetColumnXPositions
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    tableGetColumnXPositions() {
        let iHeaders = this.anchors.tableHeaders.index;
        return {
            regelNr:                /**/    { format: 'text',                       /**/ x: this.textItems[iHeaders + 0].getLeft(), },
            code:                   /**/    { format: 'text',                       /**/ x: this.textItems[iHeaders + 1].getLeft(), },
            product:                /**/    { format: 'text',                       /**/ x: this.textItems[iHeaders + 2].getLeft(), },
            gewensteLeverdatum:     /**/    { format: 'text',                       /**/ x: this.textItems[iHeaders + 3].getLeft(), },
            aantal:                 /**/    { format: 'int',                        /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 5].getLeft(), },
            eenheid:                /**/    { format: 'text',                       /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 6].getLeft(), },
            prijs:                  /**/    { format: (v) => v.replace(',', '.'),   /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 7].getLeft(), },
            kortingPercentage:      /**/    { format: (v) => v.replace(',', '.'),   /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 8].getLeft(), },
            contractNummer:         /**/    { format: 'text',                       /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 10].getLeft(), },
            referentieOfferte:      /**/    { format: 'text',                       /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 11].getLeft(), },
            belasting:              /**/    { format: (v) => v.replace(',', '.'),   /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 13].getLeft(), },
            netto:                  /**/    { format: (v) => v.replace(',', '.'),   /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 14].getLeft(), },
            totaal:                 /**/    { format: (v) => v.replace(',', '.'),   /**/ x: this.textItems[iHeaders + this.tableHeadersQuantityOffset + 15].getLeft(), },
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    tableGetColumnYPositions
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    tableGetColumnYPositions() {
        let tableYTop       /**/ = this.textItems[this.anchors.tableHeaders.index + this.anchors.tableHeaders.selection.length].getTop();
        let tableYLeft      /**/ = this.textItems[this.anchors.tableHeaders.index + this.anchors.tableHeaders.selection.length].getLeft();
        let tableYBottom    /**/ = this.anchors.nettoBedrag.textItem.getTop();
        return this.textItems.filter((textItem) => {
            if (textItem.getLeft() != tableYLeft)      /**/ return false;
            if (textItem.getTop() > tableYTop)        /**/ return false;
            if (textItem.getTop() <= tableYBottom)    /**/ return false;
            return true;
        }).map(textItem => textItem.getTop());
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    tableGetLineItems
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    tableGetLineItems() {
        let xPositions      /**/ = this.tableGetColumnXPositions();
        let yPositionVals   /**/ = this.tableGetColumnYPositions();
        let xPositionKeys   /**/ = Object.keys(xPositions);
        let xPositionVals   /**/ = Object.values(xPositions);
        let tableYBottom    /**/ = this.anchors.nettoBedrag.textItem.getTop();
        let lines = []

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // We gaan langs alle regels uit de PDF
        // Het lineObject gaat alle data uit deze ene regel bevatten.
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        for (let yIndex in yPositionVals) {
            yIndex = parseInt(yIndex);
            let lineObject = {}
            lines.push(lineObject);

            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // We halen als eerste alle content op die in deze regel staat. We krijgen dan de content die in kolommen staat en de content die 
            // in de opmerking onder elke regel staat.
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            let allTextItemsInLine = this.getTextItemsInsideBoundingBox({
                top:    /**/ yPositionVals[yIndex],
                bottom: /**/ yIndex == (yPositionVals.length - 1)
                    ? tableYBottom
                    : yPositionVals[yIndex + 1],
            });

            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // We gebruiken de opmerking als anchor voor de onderkant van het kolommendeel van de regel. Daarna zoeken we alle tekst die in de
            // kolommen staat en alle tekst die in het opmerkingendeel staat.
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            allTextItemsInLine.findAnchors({
                opmerking: [
                    /^Opmerking: /,                         // +00
                ],
            });

            let allTextItemsInColumns = allTextItemsInLine.getTextItemsInsideBoundingBox({ bottom: 'opmerking' });
            let allTextItemsInComment = allTextItemsInLine.getTextItemsInsideBoundingBox({ top: 'opmerking' });
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // Voor de kolommen 
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            for (let xIndex in xPositionVals) {
                xIndex = parseInt(xIndex);
                lineObject[xPositionKeys[xIndex]] = allTextItemsInColumns.getContentFromBoundingBox({
                    left: xPositionVals[xIndex].x,
                    right: (xPositionVals[xIndex + 1] ?? {}).x,
                    format: xPositionVals[xIndex].format
                });
            }

            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // Interpreteer de gewenste leverdatum op basis van de locale die we hebben afgeleid uit het formaat van nummers.
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            try {
                let segments = []
                if (lineObject.gewensteLeverdatum.indexOf('-') != -1) segments = lineObject.gewensteLeverdatum.split('-');
                if (lineObject.gewensteLeverdatum.indexOf('/') != -1) segments = lineObject.gewensteLeverdatum.split('/');
                if (segments.length != 3) throw new Error('Kolom Gewenste Leverdatum bevat een ongeldige datum.');
                segments[0] = Helpers.string.lpad(segments[0], 2, '0');
                segments[1] = Helpers.string.lpad(segments[1], 2, '0');
                if (this.locale == 'nl') lineObject.gewensteLeverdatum = `${segments[2]}-${segments[1]}-${segments[0]}`;
                if (this.locale == 'en') lineObject.gewensteLeverdatum = `${segments[2]}-${segments[0]}-${segments[1]}`;
            }
            catch (e) {
                // Als het een leverdatum is die we niet kunnen ontcijferen, dan halen we hem niet uit de PDF.
                // We sturen deze informatie toch niet naar Topgeschenken dus dan kunnen we hem ook wel negeren.
                lineObject.gewensteLeverdatum = null;
            }

            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // De opmerking is de tekst die in de comment staat
            /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            lineObject.opmerking = allTextItemsInComment.getText().trim().substr(11);
        }
        return lines;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:
    //
    // Description:
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async extractData() {

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Zoek anchors in het Nederlands
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let anchorsNotFoundError;
        if (this.anchors === undefined) try {
            this.findAnchors({
                orderDatum: [
                    /ORDERDA/,                              // +00
                    /TUM/,                                  // +01
                ],
                orderNummer: [
                    /ORDERNUMMER/,                          // +00
                ],
                leverancier: [
                    /Leverancier/,                          // +00
                ],
                factuurAdres: [
                    /Factuuradres/,                         // +00
                ],
                teContacterenOntvangerGoederen: [
                    /Te contacteren ontvanger goederen/,    // +00
                ],
                betalingsTermijn: [
                    /Betalingstermijn/,                     // +00
                ],
                afleverTermijn: [
                    /Aflevertermijn/,                       // +00
                ],
                locatie: [
                    /Locatie/,                              // +00
                ],
                leveringsAdres: [
                    /Leveringsadres/,                       // +00
                ],
                tableHeaders: [
                    /Nr./,                                  // +00
                    /Code/,                                 // +01
                    /Product/,                              // +02
                    /Gewenste/,                             // +03
                    /leverdatum/,                           // +04
                    /Aant\./,                               // +05
                    /Eenheid/,                              // +06
                    /Prijs/,                                // +07
                    /Korting/,                              // +08
                    /%/,                                    // +09
                    /Contractnummer/,                       // +10
                    /Referentie/,                           // +11
                    /offerte/,                              // +12
                    /Belasting/,                            // +13
                    /Netto/,                                // +14
                    /Totaal/,                               // +15
                    /1/,                                    // +16
                ],
                nettoBedrag: [
                    /Nettobedrag/,                          // +00
                    /[0-9]+[,.][0-9][0-9]/,                 // +01
                    /EUR/,                                  // +02
                ],
                belastingTotaal: [
                    /Belastingtotaal/,                      // +00
                    /[0-9]+[,.][0-9][0-9]/,                 // +01
                    /EUR/,                                  // +02
                ],
                totaalBedrag: [
                    /Totaalbedrag/,                         // +00
                    /[0-9]+[,.][0-9][0-9]/,                 // +01
                    /EUR/,                                  // +02
                ],
                btwNummer: [
                    /^BTW-nummer:/,                         // +00
                ],
                ediCode: [
                    /^EDI-code:/,                           // +00
                ],
            });
            this.tableHeadersQuantityOffset = 0;
            this.language = 'nl';
        } catch (error) {
            anchorsNotFoundError = error;
            delete this.anchors;
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Zoek anchors in het Engels
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (this.anchors === undefined) try {
            this.findAnchors({
                orderDatum: [
                    /ORDER DA/,                             // +00
                    /TE/,                                   // +01
                ],
                orderNummer: [
                    /ORDER NO\./,                           // +00
                ],
                leverancier: [
                    /Supplier/,                             // +00
                ],
                factuurAdres: [
                    /Invoicing Address/,                    // +00
                ],
                teContacterenOntvangerGoederen: [
                    /Goods receiver to contact/,            // +00
                ],
                betalingsTermijn: [
                    /Payment T/,                            // +00
                    /erm/,
                ],
                afleverTermijn: [
                    /Delivery T/,                           // +00
                    /erm/,
                ],
                locatie: [
                    /Location/,                             // +00
                ],
                leveringsAdres: [
                    /Delivery Address/,                     // +00
                ],
                tableHeaders: [
                    /Nr./,                                  // +00
                    /Code/,                                 // +01
                    /Product/,                              // +02
                    /Desired/,                              // +03
                    /Delivery/,                             // +04
                    /Date/,                                 // +05
                    /Qty/,                                  // +06
                    /Unit/,                                 // +07
                    /Price/,                                // +08
                    /Discount/,                             // +09
                    /%/,                                    // +10
                    /Contract Number/,                      // +11
                    /Quote/,                                // +12
                    /Reference/,                            // +13
                    /Tax/,                                  // +14
                    /Net/,                                  // +15
                    /Total/,                                // +16
                    /1/,                                    // +17
                ],
                nettoBedrag: [
                    /Net Total/,                            // +00
                    /[0-9]+[,.][0-9][0-9]/,                 // +01
                    /EUR/,                                  // +02
                ],
                belastingTotaal: [
                    /Tax Total/,                            // +00
                    /[0-9]+[,.][0-9][0-9]/,                 // +01
                    /EUR/,                                  // +02
                ],
                totaalBedrag: [
                    /Total Sum/,                            // +00
                    /[0-9]+[,.][0-9][0-9]/,                 // +01
                    /EUR/,                                  // +02
                ],
                btwNummer: [
                    /^VAT number:/,                         // +00
                ],
                ediCode: [
                    /^EDI code:/,                           // +00
                ],
            });
            this.tableHeadersQuantityOffset = 1;
            this.language = 'en';
        } catch (error) {
            anchorsNotFoundError = error;
            delete this.anchors;
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Zijn er geen anchors gevonden? Dan is er iets mis met het formaat.
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (this.anchors === undefined) throw anchorsNotFoundError;

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Determine number and date locale
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let rawNettoBedrag = this.getContentFromBoundingBox({
            topLeft:            /**/ 'nettoBedrag',
            bottom:             /**/ 'belastingTotaal',
            format:             /**/ 'text',
            start:              /**/ 1,
            end:                /**/ 2,
        });
        if (rawNettoBedrag.indexOf(',') != -1) this.locale = 'nl';
        if (rawNettoBedrag.indexOf('.') != -1) this.locale = 'en';

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let dataset = {
            lineItems: this.tableGetLineItems(),
            nettoBedrag: this.getContentFromBoundingBox({
                topLeft:            /**/ 'nettoBedrag',
                bottom:             /**/ 'belastingTotaal',
                format:             /**/ (v) => v.replace(',', '.'),
                start:              /**/ 1,
                end:                /**/ 2,
            }),
            belastingTotaal: this.getContentFromBoundingBox({
                topLeft:            /**/ 'belastingTotaal',
                bottom:             /**/ 'totaalBedrag',
                format:             /**/ (v) => v.replace(',', '.'),
                start:              /**/ 1,
                end:                /**/ 2,
            }),
            totaalBedrag: this.getContentFromBoundingBox({
                topLeft:            /**/ 'totaalBedrag',
                format:             /**/ (v) => v.replace(',', '.'),
                start:              /**/ 1,
                end:                /**/ 2,
            }),
            leverancier: this.getContentFromBoundingBox({
                topLeft:            /**/ 'leverancier',
                bottom:             /**/ 'leveringsAdres',
                right:              /**/ 'factuurAdres',
                format:             /**/ 'text',
                start:              /**/ 1,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }).split('\n'),
            factuurAdres: this.getContentFromBoundingBox({
                topLeft:            /**/ 'factuurAdres',
                bottom:             /**/ 'leveringsAdres',
                right:              /**/ 'teContacterenOntvangerGoederen',
                format:             /**/ 'text',
                start:              /**/ 1,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }).split('\n'),
            teContacterenOntvangerGoederen: this.getContentFromBoundingBox({
                topLeft:            /**/ 'teContacterenOntvangerGoederen',
                bottom:             /**/ 'betalingsTermijn',
                format:             /**/ 'text',
                start:              /**/ 1,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }).split('\n'),
            betalingsTermijn: this.getContentFromBoundingBox({
                topLeft:            /**/ 'betalingsTermijn',
                bottom:             /**/ 'afleverTermijn',
                format:             /**/ 'text',
                start:              /**/ 2,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }),
            locatie: this.getContentFromBoundingBox({
                topLeft:            /**/ 'locatie',
                bottom:             /**/ 'leveringsAdres',
                format:             /**/ 'text',
                start:              /**/ 1,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }),
            leveringsAdres: this.getContentFromBoundingBox({
                topLeft:            /**/ 'leveringsAdres',
                bottom:             /**/ 'tableHeaders',
                format:             /**/ 'text',
                start:              /**/ 1,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }),
            orderDatum: this.getContentFromBoundingBox({
                topLeft:            /**/ 'orderDatum',
                bottomRight:        /**/ 'teContacterenOntvangerGoederen',
                format:             /**/ 'text',
                start:              /**/ 2,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }),
            orderNummer: this.getContentFromBoundingBox({
                topLeft:            /**/ 'orderNummer',
                bottom:             /**/ 'teContacterenOntvangerGoederen',
                format:             /**/ 'text',
                start:              /**/ 1,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }),
            btwNummer: this.getContentFromBoundingBox({
                topLeft:            /**/ 'btwNummer',
                bottom:             /**/ 'ediCode',
                format:             /**/ 'text',
                start:              /**/ 0,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }).split(':')[1].trim(),
            ediCode: this.getContentFromBoundingBox({
                topLeft:            /**/ 'ediCode',
                format:             /**/ 'text',
                start:              /**/ 0,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }).split(':')[1].trim(),
            adres: this.getContentFromBoundingBox({
                top:                /**/ 'btwNummer',
                left:               /**/ 'leverancier',
                right:              /**/ 'btwNummer',
                format:             /**/ 'text',
                start:              /**/ 0,
                trimLines:          /**/ true,
                removeEmptyLines:   /**/ true,
            }).split('\n'),
        }

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Postprocessing
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (dataset.leverancier.length != 1)                                                            /**/ throw new Error(`Invalid format: Bij leverancier verwachten we exact 1 regels.`);
        dataset.leverancier = dataset.leverancier[0];

        if (dataset.adres.length != 5)                                                                  /**/ throw new Error(`Invalid format: Bij adres (linksonderaan in de footer) verwachten we exact 5 regels.`);
        dataset['adres.naam']               /**/ = dataset.adres[0];
        dataset['adres.adres']              /**/ = dataset.adres[1];
        dataset['adres.stad']               /**/ = dataset.adres[2];
        dataset['adres.postcode']           /**/ = dataset.adres[3];
        dataset['adres.landNaam']           /**/ = dataset.adres[4];
        delete dataset.adres;

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Valideer de naam van het factuuradres
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let geaccepteerdeNamen = [
            ['Company name 1'],
            ['Company name 2'],
            ['Company', 'name 2'],  // If the name is split between two lines
        ]

        let factuuradresNaam = null;
        let factuuradresOffset = 0;
        for (let mogelijkheid of geaccepteerdeNamen) {
            if (dataset.factuurAdres[0] != mogelijkheid[0]) continue;       // Geen match op eerste regel, dus verder zoeken
            if (mogelijkheid.length !== 1) {
                if (dataset.factuurAdres[1] != mogelijkheid[1]) continue;   // Geen match op tweede regel, dus verder zoeken
            }
            factuuradresNaam = mogelijkheid.join(' ');
            factuuradresOffset = mogelijkheid.length;
            break;
        }
        if (factuuradresNaam === null)                                                                                       /**/ throw new Error(`Invalid format: Bij factuuradres verwachten we voorgeprogrammeerde bedrijfsnamen en deze bedrijfsnaam kennen we niet.`);

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Valideer de rest van het factuuradres
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (dataset.factuurAdres.length != (4 + factuuradresOffset))                                                         /**/ throw new Error(`Invalid format: Bij factuuradres verwachten we na de bedrijfsnaam exact 4 regels.`);
        dataset['factuurAdres.naam']        /**/ = factuuradresNaam;
        dataset['factuurAdres.adres']       /**/ = dataset.factuurAdres[factuuradresOffset];
        dataset['factuurAdres.stad']        /**/ = dataset.factuurAdres[factuuradresOffset + 1];
        dataset['factuurAdres.postcode']    /**/ = dataset.factuurAdres[factuuradresOffset + 2];
        dataset['factuurAdres.landNaam']    /**/ = dataset.factuurAdres[factuuradresOffset + 3];

        if (dataset['factuurAdres.postcode'].match(/^[1-9][0-9][0-9][0-9] ?[A-Za-z]{2}$/) === null)     /**/ throw new Error(`Invalid format: Bij factuuradres is de postcode '${dataset['factuurAdres.postcode']}' ongeldig.`);
        if (dataset['factuurAdres.landNaam'].match(/Nederland|Netherlands|NL/i)                         /**/ !== null) dataset['factuurAdres.landCode'] = 'NL';
        if (dataset['factuurAdres.landNaam'].match(/Belgie|Belgium|BE/i)                                /**/ !== null) dataset['factuurAdres.landCode'] = 'BE';
        if (dataset['factuurAdres.landNaam'].match(/Duitsland|Germany|DE/i)                             /**/ !== null) dataset['factuurAdres.landCode'] = 'DE';
        if (dataset['factuurAdres.landNaam'].match(/Frankrijk|France|FR/i)                              /**/ !== null) dataset['factuurAdres.landCode'] = 'FR';
        if (dataset['factuurAdres.landNaam'].match(/Luxemburg|Luxembourg|LU/i)                          /**/ !== null) dataset['factuurAdres.landCode'] = 'LU';
        if (dataset['factuurAdres.landCode'] === undefined)                                             /**/ throw new Error(`Invalid format: Bij factuuradres ondersteunen we alleen de landen Nederland, België, Frankrijk, Luxemburg en Duitsland. In de PDF lazen we: '${dataset['factuurAdres.landNaam']}'`);
        delete dataset.factuurAdres;

        if ((dataset.teContacterenOntvangerGoederen.length < 2) || (dataset.teContacterenOntvangerGoederen.length > 3)) /**/ throw new Error(`Invalid format: Bij teContacterenOntvangerGoederen verwachten we 2 (naam, email) of 3 (naam, telefoon, email) regels.`);
        dataset['teContacterenOntvangerGoederen.naam']      /**/ = dataset.teContacterenOntvangerGoederen[0];
        dataset['teContacterenOntvangerGoederen.telefoon']  /**/ = dataset.teContacterenOntvangerGoederen.length == 2 ? '' : dataset.teContacterenOntvangerGoederen[1];
        dataset['teContacterenOntvangerGoederen.email']     /**/ = dataset.teContacterenOntvangerGoederen[dataset.teContacterenOntvangerGoederen.length - 1];
        if (dataset['teContacterenOntvangerGoederen.email'].match(/@/) === null)                        /**/ throw new Error('Invalid format: Bij te contacteren ontvanger goederen verwachten we op de tweede regel een email adres.');
        delete dataset.teContacterenOntvangerGoederen;

        let segments = dataset.leveringsAdres.split(',');
        if ((segments.length < 4) || (segments.length > 5))                                              /**/ throw new Error(`Invalid format: Bij leveringsadres verwachten we 4 (zonder land) of 5 (met land) comma's.`);
        dataset['leveringsAdres.naam']               /**/ = segments[0].trim();
        dataset['leveringsAdres.adres']              /**/ = segments[1].trim();
        dataset['leveringsAdres.stad']               /**/ = segments[2].trim();
        dataset['leveringsAdres.postcode']           /**/ = segments[3].trim();
        dataset['leveringsAdres.landNaam']           /**/ = segments[4] === undefined ? 'Nederland' : segments[4].trim();
        if (dataset['leveringsAdres.postcode'].match(/^[1-9][0-9][0-9][0-9] ?[A-Za-z]{2}$/) === null)   /**/ throw new Error(`Invalid format: Bij leveringsadres is de postcode '${dataset['leveringsAdres.postcode']} ongeldig.`);
        if (dataset['leveringsAdres.landNaam'].match(/Nederland|Netherlands|NL/i)                       /**/ !== null) dataset['leveringsAdres.landCode'] = 'NL';
        if (dataset['leveringsAdres.landNaam'].match(/Belgie|Belgium|BE/i)                              /**/ !== null) dataset['leveringsAdres.landCode'] = 'BE';
        if (dataset['leveringsAdres.landNaam'].match(/Duitsland|Germany|DE/i)                           /**/ !== null) dataset['leveringsAdres.landCode'] = 'DE';
        if (dataset['leveringsAdres.landNaam'].match(/Frankrijk|France|FR/i)                            /**/ !== null) dataset['leveringsAdres.landCode'] = 'FR';
        if (dataset['leveringsAdres.landNaam'].match(/Luxemburg|Luxembourg|LU/i)                        /**/ !== null) dataset['leveringsAdres.landCode'] = 'LU';
        if (dataset['leveringsAdres.landCode'] === undefined)                                           /**/ throw new Error(`Invalid format: Bij factuuradres ondersteunen we alleen de landen Nederland, België, Frankrijk, Luxemburg en Duitsland. In de PDF lazen we: '${dataset['factuurAdres.landNaam']}'`);
        delete dataset.leveringsAdres;

        dataset.timestampVerwerking = (new Date()).toISOString().replaceAll('-', '');

        return dataset;
    }
}


module.exports = OurCustomPDFFile
