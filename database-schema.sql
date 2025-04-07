-- Profiles table (existing but extended)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    date_of_birth DATE,
    profile_image_url TEXT,
    user_type TEXT NOT NULL CHECK (user_type IN ('rider', 'driver', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver profiles
CREATE TABLE driver_profiles (
    driver_id UUID PRIMARY KEY REFERENCES profiles(id),
    vehicle_type TEXT NOT NULL,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER,
    license_plate TEXT NOT NULL,
    vehicle_color TEXT,
    document_verification_status TEXT DEFAULT 'pending' CHECK (document_verification_status IN ('pending', 'verified', 'rejected')),
    driver_license_number TEXT,
    driver_license_expiry DATE,
    insurance_policy_number TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    current_location GEOGRAPHY(POINT),
    last_location_update TIMESTAMP WITH TIME ZONE,
    average_rating DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('credit_card', 'debit_card', 'paypal')),
    stripe_payment_method_id TEXT,
    last_four_digits TEXT,
    expiry_date TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rides
CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID REFERENCES profiles(id) NOT NULL,
    driver_id UUID REFERENCES profiles(id),
    pickup_location GEOGRAPHY(POINT) NOT NULL,
    dropoff_location GEOGRAPHY(POINT) NOT NULL,
    pickup_address TEXT NOT NULL,
    dropoff_address TEXT NOT NULL,
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'searching', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled')),
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES profiles(id),
    estimated_distance DECIMAL(10,2), -- In kilometers
    estimated_duration INTEGER, -- In seconds
    estimated_fare DECIMAL(10,2),
    actual_fare DECIMAL(10,2),
    route_polyline TEXT, -- Encoded polyline from Google Maps
    scheduled_time TIMESTAMP WITH TIME ZONE, -- For scheduled rides
    pickup_time TIMESTAMP WITH TIME ZONE,
    dropoff_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ride history (for tracking status changes)
CREATE TABLE ride_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) NOT NULL,
    status TEXT NOT NULL,
    location GEOGRAPHY(POINT),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    payment_method_id UUID REFERENCES payment_methods(id),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'EUR',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    stripe_payment_intent_id TEXT,
    transaction_fee DECIMAL(10,2),
    platform_fee DECIMAL(10,2),
    driver_payout DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ratings
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) NOT NULL,
    rater_id UUID REFERENCES profiles(id) NOT NULL,
    ratee_id UUID REFERENCES profiles(id) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver locations history (for analytics)
CREATE TABLE driver_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES profiles(id) NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    heading FLOAT,
    speed FLOAT,
    accuracy FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Promo codes
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User promo code usage
CREATE TABLE user_promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    promo_code_id UUID REFERENCES promo_codes(id) NOT NULL,
    ride_id UUID REFERENCES rides(id),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, promo_code_id, ride_id)
);

-- Surge pricing zones
CREATE TABLE surge_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone GEOGRAPHY(POLYGON) NOT NULL,
    multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create appropriate RLS policies
-- (Example policy for viewing profiles)
CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Add more RLS policies as needed for security
