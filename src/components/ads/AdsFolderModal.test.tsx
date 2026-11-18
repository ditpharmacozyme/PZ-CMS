import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdsFolderModal } from './AdsFolderModal';

const brands = [{ id: 'b1', name: 'Brand One' }];
const base = { audiences: ['Doctors', 'Students'], brands, programs: [{ id: 'p1', name: 'Spring Course' }], onClose: vi.fn() };

describe('AdsFolderModal', () => {
  it('blocks saving an empty/whitespace name', () => {
    const onSave = vi.fn();
    render(<AdsFolderModal mode="program" {...base} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
  });
  it('program mode saves trimmed values', () => {
    const onSave = vi.fn();
    render(<AdsFolderModal mode="program" {...base} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '  Launch ' } });
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'shared' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'webinar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Launch', brandId: 'shared', kind: 'webinar' });
  });
  it('set mode saves audience and course; Add audience only for admins', () => {
    const onSave = vi.fn();
    const { rerender } = render(<AdsFolderModal mode="set" {...base} onSave={onSave} />);
    expect(screen.queryByRole('option', { name: /Add audience/ })).toBeNull();
    rerender(<AdsFolderModal mode="set" {...base} canManageAudiences onAddAudience={vi.fn()} onSave={onSave} />);
    expect(screen.getByRole('option', { name: /Add audience/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: ' Set A ' } });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'Students' } });
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Set A', audience: 'Students', programId: 'p1' });
  });
  it('Add audience calls onAddAudience with the typed name', () => {
    const onAddAudience = vi.fn();
    render(<AdsFolderModal mode="set" {...base} canManageAudiences onAddAudience={onAddAudience} onSave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: '__add__' } });
    fireEvent.change(screen.getByLabelText('New audience name'), { target: { value: ' Nurses ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAddAudience).toHaveBeenCalledWith('Nurses');
  });
});
