
const formatDate = (d, f) => "15/05/2026";
const p = {
    transactionMode: 'FT',
    vendorName: 'TEST VENDOR',
    nickName: 'TEST',
    accountNumber: '1234567890',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC BANK',
    amount: 1000,
    emailId: 'test@example.com',
    valueDate: new Date()
};

function buildICICIDataRows(payments, formatDate) {
    return payments.map(p => {
        const trnType = p.transactionMode === 'NFT' ? 'N' : p.transactionMode === 'RTI' ? 'R' : 'I';
        const cleanName = (p.vendorName || '').replace(/,/g, '').trim();
        const beneCode = (p.nickName || cleanName).substring(0, 13).trim();
        const custRef = (p.nickName || cleanName.split(' ')[0]).substring(0, 30).trim();

        const row = Array(33).fill(''); // Using 33 as per my fix
        row[0] = trnType;
        row[1] = beneCode;
        row[2] = p.accountNumber;
        row[3] = String(p.amount);
        row[4] = p.vendorName.trim();
        row[13] = custRef;
        row[22] = formatDate(p.valueDate, 'dd/MM/yyyy');
        row[24] = p.transactionMode === 'FT' ? '' : p.ifscCode;
        row[25] = p.transactionMode === 'FT' ? '' : (p.bankName || '').replace(/,/g, '');
        row[32] = (p.emailId || '').replace(/,/g, '');
        return row;
    });
}

const rows = buildICICIDataRows([p], formatDate);
const line = rows[0].join(',');
console.log("Line content:");
console.log(line);
const parts = line.split(',');
console.log("Total parts:", parts.length);
console.log("Date index:", parts.indexOf("15/05/2026"));
const dateIdx = parts.indexOf("15/05/2026");
console.log("Commas after date:", parts.length - 1 - dateIdx);
