const formidable = require("formidable");
const { access, copyFile, unlink } = require("fs/promises");
const { authenticate, isAuthenticated } = require("./jwt-authenticate");

const responseBadRequest = (res) => {
  res.writeHead(400, { "Content-Type": "text/plain" });
  res.end("Bad Request!");
};

const responseServerError = (res) => {
  res.writeHead(500, { "Content-Type": "text/plain" });
  res.end("Internal Server Error!");
};

const handleUploadFile = async (req, file) => {
  const uploadFolder = "uploads";

  try {
    // Copy file from temp folder to uploads folder (not rename to allow cross-device link)
    await copyFile(file.path, `./public/${uploadFolder}/${file.name}`);

    // Remove temp file
    await unlink(file.path);

    // Return new path of uploaded file
    file.path = `${req.protocol}://${req.get("host")}/${uploadFolder}/${
      file.name
    }`;

    return file;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  loginHandler: (req, res, next) => {
    authenticate(req.body)
      .then((user) =>
        user
          ? res.jsonp(user)
          : res
              .status(400)
              .jsonp({ message: "Username or password is incorrect!" })
      )
      .catch((err) => next(err));
  },

  registerHandler: (db, req, res) => {
    const lastUser = db.get("users").maxBy("id").value();
    const newUserId = parseInt(lastUser.id) + 1;
    const newUser = { id: newUserId, ...req.body };

    db.get("users").push(newUser).write();

    res.jsonp(newUser);
  },

  uploadFileHandler: (req, res) => {
    if (req.headers["content-type"] === "application/json") {
      responseBadRequest(res);
      return;
    }

    const form = formidable();

    form.parse(req, async (err, fields, files) => {
      let file = files.file;

      if (err || !file) {
        responseBadRequest(res);
        return;
      }

      try {
        file = await handleUploadFile(req, file);
        res.jsonp(file);
      } catch (err) {
        console.log(err);
        responseServerError(res);
      }
    });
  },

  uploadFilesHandler: (req, res) => {
    if (req.headers["content-type"] === "application/json") {
      responseBadRequest(res);
      return;
    }

    const form = formidable({ multiples: true });

    form.parse(req, async (err, fields, files) => {
      let filesUploaded = files.files;

      if (err || !filesUploaded) {
        responseBadRequest(res);
        return;
      }

      // If user upload 1 file, transform data to array
      if (!Array.isArray(filesUploaded)) filesUploaded = [filesUploaded];

      try {
        // Handle all uploaded files
        filesUploaded = await Promise.all(
          filesUploaded.map(async (file) => {
            try {
              file = await handleUploadFile(req, file);
              return file;
            } catch (err) {
              throw err;
            }
          })
        );

        res.jsonp(filesUploaded);
      } catch (err) {
        console.log(err);
        responseServerError(res);
      }
    });
  },
};