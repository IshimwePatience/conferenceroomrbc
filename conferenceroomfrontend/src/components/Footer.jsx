import React from 'react';
import rbc from '../assets/images/rbcphoto.png'

const Footer = () => {
  return (
    <footer className="bg-black text-white">
      <div className="w-full px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
           <img src ={rbc} alt = 'rbc' className='w-15 h-15' />
            <p className="text-gray-300 text-sm leading-relaxed">
              Professional conference room booking platform. 
              Making meeting space reservations simple and efficient.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h4 className="text-lg font-['Poppins']">Features</h4>
            <ul className="space-y-2">
              <li className="text-gray-300 text-sm">Real-time Availability</li>
              <li className="text-gray-300 text-sm">Instant Booking</li>
              <li className="text-gray-300 text-sm">Calendar Integration</li>
              <li className="text-gray-300 text-sm">Meeting Analytics</li>
              <li className="text-gray-300 text-sm">Room Management</li>
            </ul>
          </div>

          {/* Room Types */}
          <div className="space-y-4">
            <h4 className="text-lg font-['Poppins']">Room Types</h4>
            <ul className="space-y-2">
              <li className="text-gray-300 text-sm">Small Meeting Rooms</li>
              <li className="text-gray-300 text-sm">Large Conference Halls</li>
              <li className="text-gray-300 text-sm">Executive Boardrooms</li>
              <li className="text-gray-300 text-sm">Training Rooms</li>
             
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="text-lg font-['Poppins']">Contact</h4>
            <div className="space-y-3">
              <div className="text-gray-300 text-sm">RBC Kimihurura, Kigali, Rwanda</div>
              <div className="text-gray-300 text-sm">+250 783 202 922</div>
              <div className="text-gray-300 text-sm">booking@rbc.rw</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 my-8"></div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-gray-400 text-sm">
            © 2025 RBC. All rights reserved.
          </p>
          
        </div>
      </div>
    </footer>
  );
};

export default Footer;