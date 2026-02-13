import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Contact, Campaign, ContactStatus, TouchLog, generateId, createEmptyWeekProgress, TouchOutcome } from '@/types/crm';
import { defaultCampaigns } from '@/data/defaultCampaigns';

interface CrmContextType {
  contacts: Contact[];
  campaigns: Campaign[];
  addContact: (contact: Omit<Contact, 'id' | 'weekProgress' | 'touchLogs' | 'currentWeek' | 'lastTouchDate' | 'nextTouchDate'>) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  markTouchDone: (contactId: string, week: number, channel: 'LinkedIn' | 'Email') => void;
  setWeekOutcome: (contactId: string, week: number, outcome: TouchOutcome | '') => void;
  setWeekNotes: (contactId: string, week: number, notes: string) => void;
  setContactStatus: (contactId: string, status: ContactStatus) => void;
  snoozeContact: (contactId: string, days: number) => void;
  reactivateContact: (contactId: string) => void;
  bookMeeting: (contactId: string) => void;
  addCampaign: (campaign: Omit<Campaign, 'id'>) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;
  getTodaysTasks: () => Contact[];
  getOverdueTasks: () => Contact[];
  getCampaignById: (id: string) => Campaign | undefined;
}

const CrmContext = createContext<CrmContextType | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch { return fallback; }
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>(() => loadFromStorage('crm_contacts', []));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadFromStorage('crm_campaigns', defaultCampaigns));

  useEffect(() => { localStorage.setItem('crm_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem('crm_campaigns', JSON.stringify(campaigns)); }, [campaigns]);

  const addContact = useCallback((contact: Omit<Contact, 'id' | 'weekProgress' | 'touchLogs' | 'currentWeek' | 'lastTouchDate' | 'nextTouchDate'>) => {
    const today = new Date().toISOString().split('T')[0];
    const newContact: Contact = {
      ...contact,
      id: generateId(),
      currentWeek: 1,
      lastTouchDate: '',
      nextTouchDate: contact.startDate || today,
      weekProgress: createEmptyWeekProgress(),
      touchLogs: [],
    };
    setContacts(prev => [...prev, newContact]);
  }, []);

  const updateContact = useCallback((id: string, updates: Partial<Contact>) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteContact = useCallback((id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  }, []);

  const markTouchDone = useCallback((contactId: string, week: number, channel: 'LinkedIn' | 'Email') => {
    setContacts(prev => prev.map(c => {
      if (c.id !== contactId) return c;
      const today = new Date().toISOString().split('T')[0];
      const wp = c.weekProgress.map(w => {
        if (w.week !== week) return w;
        return channel === 'LinkedIn' ? { ...w, liDone: true } : { ...w, emailDone: true };
      });

      const weekData = wp.find(w => w.week === week)!;
      const touchLog: TouchLog = {
        id: generateId(),
        date: today,
        channel,
        weekNum: week,
        touchNum: c.touchLogs.length + 1,
        ctaUsed: weekData.ctaUsed,
        assetSent: weekData.assetSent,
        outcome: weekData.outcome,
        notes: weekData.notes,
      };

      let newCurrentWeek = c.currentWeek;
      let nextTouchDate = c.nextTouchDate;

      if (weekData.liDone && weekData.emailDone) {
        // Both done for this week — advance
        if (week < 12) {
          newCurrentWeek = week + 1;
          const next = new Date();
          next.setDate(next.getDate() + 7);
          nextTouchDate = next.toISOString().split('T')[0];
        }
      } else if (channel === 'LinkedIn') {
        // LI done, email in 3 days
        const next = new Date();
        next.setDate(next.getDate() + 3);
        nextTouchDate = next.toISOString().split('T')[0];
      }

      return {
        ...c,
        weekProgress: wp,
        touchLogs: [...c.touchLogs, touchLog],
        currentWeek: newCurrentWeek,
        lastTouchDate: today,
        nextTouchDate,
        status: c.status === 'Unworked' ? 'In Sequence' as ContactStatus : c.status,
      };
    }));
  }, []);

  const setWeekOutcome = useCallback((contactId: string, week: number, outcome: TouchOutcome | '') => {
    setContacts(prev => prev.map(c => {
      if (c.id !== contactId) return c;
      const wp = c.weekProgress.map(w => w.week === week ? { ...w, outcome } : w);
      let status = c.status;
      if (outcome === 'Meeting Booked') status = 'Hot';
      else if (outcome === 'Bad Fit' || outcome === 'Negative Reply') status = 'Disqualified';
      else if (outcome === 'Positive Reply') status = 'Warm';
      return { ...c, weekProgress: wp, status };
    }));
  }, []);

  const setWeekNotes = useCallback((contactId: string, week: number, notes: string) => {
    setContacts(prev => prev.map(c => {
      if (c.id !== contactId) return c;
      const wp = c.weekProgress.map(w => w.week === week ? { ...w, notes } : w);
      return { ...c, weekProgress: wp };
    }));
  }, []);

  const setContactStatus = useCallback((contactId: string, status: ContactStatus) => {
    updateContact(contactId, { status });
  }, [updateContact]);

  const snoozeContact = useCallback((contactId: string, days: number) => {
    const next = new Date();
    next.setDate(next.getDate() + days);
    updateContact(contactId, { nextTouchDate: next.toISOString().split('T')[0] });
  }, [updateContact]);

  const reactivateContact = useCallback((contactId: string) => {
    const today = new Date().toISOString().split('T')[0];
    updateContact(contactId, {
      status: 'In Sequence',
      currentWeek: 1,
      nextTouchDate: today,
      weekProgress: createEmptyWeekProgress(),
      touchLogs: [],
    });
  }, [updateContact]);

  const bookMeeting = useCallback((contactId: string) => {
    updateContact(contactId, { status: 'Hot' });
  }, [updateContact]);

  const addCampaign = useCallback((campaign: Omit<Campaign, 'id'>) => {
    setCampaigns(prev => [...prev, { ...campaign, id: generateId() }]);
  }, []);

  const updateCampaign = useCallback((id: string, updates: Partial<Campaign>) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCampaign = useCallback((id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
  }, []);

  const getTodaysTasks = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return contacts.filter(c =>
      c.status === 'In Sequence' && c.nextTouchDate <= today
    );
  }, [contacts]);

  const getOverdueTasks = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return contacts.filter(c =>
      c.status === 'In Sequence' && c.nextTouchDate < today
    );
  }, [contacts]);

  const getCampaignById = useCallback((id: string) => {
    return campaigns.find(c => c.id === id);
  }, [campaigns]);

  return (
    <CrmContext.Provider value={{
      contacts, campaigns,
      addContact, updateContact, deleteContact,
      markTouchDone, setWeekOutcome, setWeekNotes,
      setContactStatus, snoozeContact, reactivateContact, bookMeeting,
      addCampaign, updateCampaign, deleteCampaign,
      getTodaysTasks, getOverdueTasks, getCampaignById,
    }}>
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error('useCrm must be used within CrmProvider');
  return ctx;
}
