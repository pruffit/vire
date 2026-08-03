const STORAGE_KEY = 'vire-offline-owner';

export function shouldPurge(savedOwner: string | null, currentOwner: string): boolean {
  return savedOwner !== null && savedOwner !== currentOwner;
}

export function getSavedOwner(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setSavedOwner(owner: string): void {
  localStorage.setItem(STORAGE_KEY, owner);
}
