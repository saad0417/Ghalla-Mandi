import multer from "multer";
import crypto from "crypto";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/temp");
    },

    filename: function (req, file, cb) {
        const uniqueName = `${crypto.randomUUID()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

export const upload = multer({storage});
