import Counter from "../models/counter.model.js";

const generateCode = async (type, prefix, session) => {

    const counter = await Counter.findOneAndUpdate(
        { _id: type },
        { $inc: { sequence: 1 } },
        {
            new: true,
            upsert: true,
            session
        }
    );

    return `${prefix}-${String(counter.sequence).padStart(4, "0")}`;
};

export default generateCode;