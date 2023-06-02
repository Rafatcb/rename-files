const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function runAndExit() {
  await run();
  process.exit();
}

async function run() {
  try {
    const folderPath = await getUserEntry('Enter folder path: ');
    const files = await fs.readdir(folderPath);
    if (files.length === 0) {
      console.log('No file found.');
      return;
    }

    printFiles(files);
    printPatterns();

    let newName = await getUserEntry('Enter new file name: ');
    newName = newName.replace('{today}', getTodayDate());
    console.log(`The files in ${folderPath} will be renamed to ${newName} - 1.ext, ${newName} - 2.ext, etc.`);

    const answer = await getUserEntry('Do you want to proceed? (y/n): ');
    if (answer.toLowerCase() !== 'y') {
      rl.close();
      return;
    }

    await renameFiles(folderPath, newName);
    rl.close();
  } catch (err) {
    console.error(err);
    rl.close();
  }
}

async function getUserEntry(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

function printFiles(files) {
  const filePluralSingular = files.length > 1 ? 'files' : 'file';
  console.log(`${files.length} ${filePluralSingular} found:`);
  files.forEach(file => console.log(`  - ${file}`));
}

function printPatterns() {
  console.log(`\nAvailable file name patterns:`);
  console.log(`  {today} = ${getTodayDate()} (today as YYYY-MM-DD)`);
  console.log(`  {modifiedAt} = file modified date as YYYY-MM-DD\n`);
}

function getTodayDate() {
  const today = new Date();
  return formatDate(today);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function renameFiles(folderPath, newName) {
  const files = await fs.readdir(folderPath);
  console.log('Renaming files...');

  const { names, totalOccurrencesByName } = await getTotalOccurrencesByName(files, folderPath, newName);
  const promises = renameFilesWithIndex(files, folderPath, names, totalOccurrencesByName);
  await Promise.all(promises);

  const filePluralSingular = files.length > 1 ? 'files' : 'file';
  console.log(`Successfully renamed ${promises.length} ${filePluralSingular}.`);
}

async function getTotalOccurrencesByName(files, folderPath, newName) {
  const names = [];
  const totalOccurrencesByName = {};
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const oldPath = path.join(folderPath, file);
    const newNameWithDate = await replaceModifiedAt(newName, oldPath);
    names.push(newNameWithDate);
    incrementNameOccurrence(newNameWithDate, totalOccurrencesByName);
  }
  return { names, totalOccurrencesByName };
}

async function replaceModifiedAt(name, filePath) {
  if (name.includes('{modifiedAt}')) {
    const modifiedAtDate = (await fs.stat(filePath)).mtime;
    return name.replace('{modifiedAt}', formatDate(modifiedAtDate));
  }
  return name;
}

function incrementNameOccurrence(name, nameOccurrences) {
  if (nameOccurrences[name]) {
    nameOccurrences[name]++;
  } else {
    nameOccurrences[name] = 1;
  }
}

function renameFilesWithIndex(files, folderPath, names, totalOccurrencesByName) {
  const promises = [];
  const currentOccurrenceByName = {};
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const newName = names[i];
    incrementNameOccurrence(newName, currentOccurrenceByName);
    const newNameWithIndex = getNewNameWithIndex(newName, totalOccurrencesByName, currentOccurrenceByName);
    const ext = path.extname(file).toLowerCase();
    const newPath = path.join(folderPath, `${newNameWithIndex}${ext}`);

    const oldPath = path.join(folderPath, file);
    promises.push(rename(oldPath, newPath));
  }
  return promises;
}

function getNewNameWithIndex(name, totalNameOccurrences, currentNameOccurrence) {
  const occurrenceCount = totalNameOccurrences[name] ?? 1;
  if (occurrenceCount === 1) {
    return name;
  } else {
    return `${name} - ${currentNameOccurrence[name] ?? 1}`;
  }
}

async function rename(oldPath, newPath) {
  await fs.rename(oldPath, newPath);
  console.log(`Renamed ${oldPath} to ${newPath}`);
}

runAndExit();
