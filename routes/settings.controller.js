import Settings from '../models/settings.schema.js';

export const getSettings = async (req, res) => {
    try {
        const { businessId } = req.user;
        let settings = await Settings.findOne({ businessId });

        if (!settings) {
            // Return empty defaults if none exist yet
            settings = {
                name: '',
                address: '',
                email: '',
                phone: '',
                gstin: '',
                footerMessage: '',
                logo: ''
            };
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ message: "Failed to fetch settings" });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const { businessId } = req.user;
        const updates = req.body;

        const updatedSettings = await Settings.findOneAndUpdate(
            { businessId },
            { 
                $set: {
                    name: updates.name,
                    phone: updates.phone,
                    email: updates.email,
                    address: updates.address,
                    gstin: updates.gstin,
                    footerMessage: updates.footerMessage,
                    logo: updates.logo
                }
            },
            { new: true, upsert: true }
        );

        res.status(200).json(updatedSettings);
    } catch (error) {
        console.error("Error updating settings:", error);
        res.status(500).json({ message: "Failed to update settings" });
    }
};
