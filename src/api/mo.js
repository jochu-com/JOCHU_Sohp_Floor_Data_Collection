import { postToGAS } from './client';

export const getProductInfo = async (partNo) => {
    return postToGAS('getProductInfo', { partNo });
};

export const createMO = async (moData) => {
    // moData: { partNo, orderNo, quantity, email, username }
    return postToGAS('createMO', moData);
};
