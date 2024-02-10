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
module.exports = class MessageReport {

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    constructor(task, subject) {
        this.task = task;
        this.messageStack = []
        this.subject = subject;
        this.attachments = []

        this.log('')
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    attach(name, content) {
        this.attachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            contentBytes: Buffer.from(content, 'utf-8').toString('base64'),
            contentType: 'text/xml',
            isInline: false,
            name: name,
        });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    log(message) {
        this.messageStack.push(message);
        console.log(message);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Function:    
    //
    // Description: 
    //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    async send(finalStatus) {

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Build HTML message
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let htmlLines = this.messageStack.map(line => line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')).join('\n');
        let html = `
        <!DOCTYPE html>
        <html>
          <p style="font-family: consolas; font-size: 12px; font-weight: bold">Introductie</p>
          <p style="font-family: consolas; font-size: 12px;">
            Dit is een rapport van de Basware PDF2XML converter.
          </p>
          <p style="font-family: consolas; font-size: 12px;">
            De Basware PDFXML Converter is een job die draait elke twee minuten en doet dan het volgende:
          </p>
          <ul>
           <li style="font-family: consolas; font-size: 12px;">
             Hij kijkt in de mailbox <b>${this.task.mailboxUserPrincipalName}</b> of er berichten staan in de map <b>${this.task.mailboxFolderTodo.displayName}</b>.
           </li>
           <li style="font-family: consolas; font-size: 12px;">
             Alle berichten waarvan het onderwerp begint met <b>"PDF2XML "</b>, gelezen of ongelezen, worden verplaatst naar de map <b>${this.task.mailboxFolderLogVerwerkingen.displayName}</b>. Op die manier worden berichten zoals deze automatisch verzameld in deze map.
           </li>
           <li style="font-family: consolas; font-size: 12px;">
             Voor berichten die <b>ongelezen</b> zijn,
             én waarvan het onderwerp begint met iets wat lijkt op <b>"Inkooporder POXXXXXXXXXXXX van "</b> of <b>"Purchase order POXXXXXXXXXXXX from "</b>,
             én die exact één bijlage hebben,
             én de naam van die bijlage lijkt op <b>"POXXXXXXXXXXXX.pdf"</b>
             én die bijlage is technisch ook aangeduid als zijnde een pdf (content-type: application/pdf) geldt het volgende:
             <ul>
               <li style="font-family: consolas; font-size: 12px;">
                 We controleren of de PDF voldoet aan de verwachte structuur, door een aantal teksten, zogenaamde "anchors" te zoeken, zowel voor Nederlandstalige als Engelstalige PDFs.
               </li>
               <li style="font-family: consolas; font-size: 12px;">
                 We bepalen het formaat van de datum (dag/maand/jaar (nl) of maand/dag/jaar (us)) door te kijken of er een punt (.) of comma (,) staat als scheidingsteken voor de decimalen bij het nettobedrag.
               </li>
               <li style="font-family: consolas; font-size: 12px;">
                 We halen de gegevens uit de PDF en tonen die hieronder
               </li>
               <li style="font-family: consolas; font-size: 12px;">
                 We gebruiken de gegevens uit de PDF om de XML in de bijlage te produceren en sturen deze naar de leverancier.
               </li>
               <li style="font-family: consolas; font-size: 12px;">
                 We genereren een bericht zoals deze en zetten deze in de inbox. Bij de volgende run van de integratie wordt die naar de map <b>${this.task.mailboxFolderLogVerwerkingen.displayName}</b> verplaatst.
               </li>
               <li style="font-family: consolas; font-size: 12px;">
                 We verplaatsen de originele email van Basware naar de map <b>${this.task.mailboxFolderDone.displayName}</b>.
               </li>
               <li style="font-family: consolas; font-size: 12px;">
                 Gaat er in de verwerking iets fout? Bijvoorbeeld omdat de PDF niet goed is of omdat de webshop een foutmelding geeft dan verplaatsen we de originele email van Basware naar de map <b>${this.task.mailboxFolderError.displayName}</b>.
               </li>
             </ul>
           <li style="font-family: consolas; font-size: 12px;">
             Overige berichten die ongelezen zijn gaan naar de map <b>${this.task.mailboxFolderSkipped.displayName}</b>.
           </li>
         </ul>
         <p style="font-family: consolas; font-size: 12px; font-weight: bold">Preflight check</p>
         <p style="font-family: consolas; font-size: 12px;">
           Door de omgevingsvariabele APP_TEST_PREFLIGHTCHECK op 'true' te zetten verandert het gedrag van de integratie. Het xml document wordt niet naar de webshop gestuurd en het verslag blijft in de inbox staan. Zo kan je bij problemen onderzoek doen zonder dat elk document naar de webshop gaat.
         </p>
         <p style="font-family: consolas; font-size: 12px; font-weight: bold">Relevante details in de verwerking</p>
         <p style="font-family: consolas; font-size: 12px;">
           Nadat je een bestelling doet in de webshop kom je terug in Basware en vraagt Basware om een afleveradres en een afleverdatum. Beiden geven we <b>niet</b> door aan de webshop, want de medewerker heeft het afleveradres al op de webshop ingevuld.
           Bovendien is Basware niet in staat om die gegevens die van de webshop naar Basware toe terugkomen te verwerken.
         </p>
         <p style="font-family: consolas; font-size: 12px; font-weight: bold">Beheer en onderhoud</p>
         <p style="font-family: consolas; font-size: 12px;">
           Dit is geen stabiele oplossing. De kleinste aanpassing bij Basware kan leiden tot veranderingen in de structuur van de PDF die technisch zichtbaar zijn en effect hebben, maar op het oog niet te zien zijn. Daarom is dit alleen een tijdelijke oplossing, gebouwd in januari 2023, totdat Basware direct kan koppelen met de leverancier van de webshop.
         </p>
         <p style="font-family: consolas; font-size: 12px; font-weight: bold">Verslaglegging</p>
         <pre style="font-family: consolas; font-size: 12px;">${htmlLines}</pre>
        </html>
        `

        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Build Graph message
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        try {
            await this.task.msClient.mailSendMail(this.task.mailboxUserPrincipalName, {
                message: {
                    toRecipients: [
                        {
                            emailAddress: {
                                address: this.task.mailboxUserPrincipalName,
                            }
                        }
                    ],
                    body: {
                        content: html,
                        contentType: 'html',
                    },
                    attachments: this.attachments,
                    subject: 'PDF2XML ' + finalStatus + ': ' + this.subject,
                },
                saveToSentItems: "false",
            });
        } catch (e) {
            console.log('Failed to send email with report');
            console.log(e);
        }
    }
}