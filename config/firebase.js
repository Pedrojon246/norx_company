// config/firebase.js - Firebase Configuration
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db = null;

const initializeFirebase = () => {
    try {
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
        };

        // Check if required environment variables exist
        const requiredVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_PRIVATE_KEY',
            'FIREBASE_CLIENT_EMAIL'
        ];

        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.error('❌ Missing Firebase environment variables:', missingVars);
            return null;
        }

        initializeApp({
            credential: cert(serviceAccount)
        });

        db = getFirestore();
        console.log('✅ Firebase initialized successfully');
        
        return db;
    } catch (error) {
        console.error('❌ Error initializing Firebase:', error.message);
        return null;
    }
};

const getDB = () => {
    if (!db) {
        console.warn('⚠️ Firebase not initialized. Call initializeFirebase() first.');
    }
    return db;
};

// Firebase utility functions
const collections = {
    USERS: 'users',
    PAYMENTS: 'payments',
    SERVICES: 'services',
    ANALYTICS: 'analytics'
};

// Common database operations
const dbOperations = {
    // Create document
    async create(collection, docId, data) {
        try {
            if (!db) throw new Error('Firebase not initialized');
            
            const docRef = db.collection(collection).doc(docId);
            await docRef.set({
                ...data,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            return { success: true, id: docId };
        } catch (error) {
            console.error(`Error creating document in ${collection}:`, error);
            return { success: false, error: error.message };
        }
    },

    // Get document by ID
    async getById(collection, docId) {
        try {
            if (!db) throw new Error('Firebase not initialized');
            
            const doc = await db.collection(collection).doc(docId).get();
            
            if (!doc.exists) {
                return { success: false, error: 'Document not found' };
            }
            
            return { success: true, data: doc.data() };
        } catch (error) {
            console.error(`Error getting document from ${collection}:`, error);
            return { success: false, error: error.message };
        }
    },

    // Update document
    async update(collection, docId, data) {
        try {
            if (!db) throw new Error('Firebase not initialized');
            
            await db.collection(collection).doc(docId).update({
                ...data,
                updatedAt: new Date().toISOString()
            });
            
            return { success: true };
        } catch (error) {
            console.error(`Error updating document in ${collection}:`, error);
            return { success: false, error: error.message };
        }
    },

    // Get all documents with optional ordering
    async getAll(collection, orderBy = 'createdAt', direction = 'desc') {
        try {
            if (!db) throw new Error('Firebase not initialized');
            
            const snapshot = await db.collection(collection)
                .orderBy(orderBy, direction)
                .get();
            
            const documents = [];
            snapshot.forEach(doc => {
                documents.push({ id: doc.id, ...doc.data() });
            });
            
            return { success: true, data: documents };
        } catch (error) {
            console.error(`Error getting documents from ${collection}:`, error);
            return { success: false, error: error.message };
        }
    },

    // Query documents with where clause
    async query(collection, field, operator, value) {
        try {
            if (!db) throw new Error('Firebase not initialized');
            
            const snapshot = await db.collection(collection)
                .where(field, operator, value)
                .get();
            
            const documents = [];
            snapshot.forEach(doc => {
                documents.push({ id: doc.id, ...doc.data() });
            });
            
            return { success: true, data: documents };
        } catch (error) {
            console.error(`Error querying ${collection}:`, error);
            return { success: false, error: error.message };
        }
    }
};

module.exports = {
    initializeFirebase,
    getDB,
    collections,
    dbOperations
};