const slugify = require('slugify');

function hasPermission(user, permissionsNeeded) {
  const matchedPermissions = user.permissions.filter(permissionTheyHave =>
    permissionsNeeded.includes(permissionTheyHave)
  );
  if (!matchedPermissions.length) {
    throw new Error(`You do not have sufficient permissions

      : ${permissionsNeeded}

      You Have:

      ${user.permissions}
      `);
  }
}

exports.hasPermission = hasPermission;

// remove duplicates from an array (also include lower and uppercase cases, so we can't use Set)
// whitespaces where removed already!
function removeDuplicates(array){
  const newArray = [];
  array.map(item => {
      const check = newArray.find(newItem => newItem.toLowerCase() == item.toLowerCase());
      if(!check){
          newArray.push(item)
      }
  })
  return newArray;
}

exports.removeDuplicates = removeDuplicates;

// make slug from string
function makeSlug(string){
  return slugify(string, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
}

exports.makeSlug = makeSlug;

// cleanup input
function cleanupInput(text){
  if(!text) return false;
  return text.trim().replace(/\s{2,}/g, ' ');
}

exports.cleanupInput = cleanupInput;