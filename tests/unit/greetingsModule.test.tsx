import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GreetingsPage, FESTIVAL_THEMES } from '@/pages/GreetingsPage';
import { settingsRepository } from '@/db/repositories/settingsRepository';

describe('Festival Greeting Cards Studio Module', () => {
  beforeEach(async () => {
    // Seed agent profile
    await settingsRepository.set('agent_profile', {
      fullName: 'Ramesh Chandra Sharma',
      agencyCode: '08345678',
      branchName: 'Connaught Place Branch',
      branchCode: '12K',
      division: 'Delhi DO-1',
      mobileNumber: '9876543210',
      whatsappNumber: '9876543210',
      email: 'ramesh.lic@gmail.com',
      clubMembership: "Chairman's Club Member",
      developmentOfficerName: 'S. K. Gupta',
      developmentOfficerMobile: '9811122233',
      agencyStartDate: '2015-05-01',
      officeAddress: 'New Delhi',
      whatsappSignature: 'Warm regards',
      avatarUrl: '',
      updatedAt: new Date().toISOString(),
    });
  });

  it('renders festival greeting themes and includes all major Indian festivals', () => {
    render(
      <BrowserRouter>
        <GreetingsPage />
      </BrowserRouter>
    );

    // Verify main page title
    expect(screen.getByText('Festival Greeting Cards')).toBeInTheDocument();

    // Verify major Indian festivals are present in theme list
    const themeNames = FESTIVAL_THEMES.map((t) => t.name);
    expect(themeNames).toContain('Diwali');
    expect(themeNames).toContain('New Year');
    expect(themeNames).toContain('Holi');
    expect(themeNames).toContain('Dussehra');
    expect(themeNames).toContain('Ganesh Chaturthi');
    expect(themeNames).toContain('Maha Shivratri');
    expect(themeNames).toContain('Raksha Bandhan');
    expect(themeNames).toContain('Eid Mubarak');
    expect(themeNames).toContain('Republic / Independence Day');
    expect(themeNames).toContain('Client Birthday Wishes');
  });

  it('displays agent credentials in the greeting card branding section', async () => {
    render(
      <BrowserRouter>
        <GreetingsPage />
      </BrowserRouter>
    );

    // Verify agent branding information renders
    const agentNameElements = await screen.findAllByText('Ramesh Chandra Sharma');
    expect(agentNameElements.length).toBeGreaterThan(0);

    const clubElements = await screen.findAllByText("Chairman's Club Member");
    expect(clubElements.length).toBeGreaterThan(0);

    const agencyCode = await screen.findByText(/Code: 08345678/i);
    expect(agencyCode).toBeInTheDocument();

    const phoneElement = await screen.findByText(/9876543210/i);
    expect(phoneElement).toBeInTheDocument();
  });

  it('allows switching formats between square and status story', () => {
    render(
      <BrowserRouter>
        <GreetingsPage />
      </BrowserRouter>
    );

    const statusBtn = screen.getByText('Status (9:16) Story');
    fireEvent.click(statusBtn);

    expect(screen.getByText(/9:16 Status/i)).toBeInTheDocument();
  });
});
