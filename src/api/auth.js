import { postToGAS } from './client';

export const registerUser = async (username, password, email) => {
    return postToGAS('register', { username, password, email });
};

export const loginUser = async (username, password) => {
    return postToGAS('login', { username, password });
};
