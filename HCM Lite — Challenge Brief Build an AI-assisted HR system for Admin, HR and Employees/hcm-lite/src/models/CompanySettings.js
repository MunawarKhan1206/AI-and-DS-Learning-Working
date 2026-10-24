import mongoose from 'mongoose';

const CompanySettingsSchema = new mongoose.Schema(
  {
    company_name: {
      type: String,
      required: true,
      trim: true,
    },
    office_start: {
      type: String,
      default: '09:00', // HH:MM 24h
    },
    grace_minutes: {
      type: Number,
      default: 15,
    },
    half_day_hours: {
      type: Number,
      default: 5,
    },
    weekend_days: {
      type: [Number],
      default: [0, 6], // 0 = Sun, 6 = Sat
    },
    office_lat: {
      type: Number,
      default: null,
    },
    office_lng: {
      type: Number,
      default: null,
    },
    office_radius_meters: {
      type: Number,
      default: 150,
    },
  },
  { timestamps: true }
);

export default mongoose.models.CompanySettings ||
  mongoose.model('CompanySettings', CompanySettingsSchema);
